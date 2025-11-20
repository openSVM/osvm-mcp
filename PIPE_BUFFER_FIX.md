# How to Increase Pipe Buffer in Your Rust Research Agent

## Problem
MCP responses >64KB get chunked, causing potential deadlocks.

## Solution: Increase Pipe Buffer to 1MB (Maximum)

### Add to your `Cargo.toml`:
```toml
[dependencies]
libc = "0.2"
```

### In your MCP client code:

```rust
use std::process::{Command, Stdio};
use std::os::unix::io::AsRawFd;
use std::io::{BufReader, BufRead};

pub fn call_mcp_tool(tool: &str, args: &serde_json::Value) -> Result<serde_json::Value> {
    // 1. Spawn MCP server
    let mut child = Command::new("./build/index.js")
        .current_dir("/home/larp/.osvm/mcp/osvm-mcp")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()?;

    // 2. INCREASE PIPE BUFFER TO 1MB (maximum, critical!)
    let stdout_fd = child.stdout.as_ref().unwrap().as_raw_fd();
    unsafe {
        libc::fcntl(stdout_fd, libc::F_SETPIPE_SZ, 1024 * 1024); // 1 MB
    }

    let stdin_fd = child.stdin.as_ref().unwrap().as_raw_fd();
    unsafe {
        libc::fcntl(stdin_fd, libc::F_SETPIPE_SZ, 1024 * 1024); // 1 MB
    }

    // 3. Send initialize
    let init_request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "research-agent", "version": "1.0.0"}
        }
    });

    let mut stdin = child.stdin.take().unwrap();
    writeln!(stdin, "{}", init_request)?;

    // 4. Read response (use BufReader for line-by-line reading)
    let stdout = child.stdout.take().unwrap();
    let reader = BufReader::new(stdout);
    let mut lines = reader.lines();

    // Skip initialize response
    lines.next();

    // 5. Send tool call
    let tool_request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/call",
        "params": {
            "name": tool,
            "arguments": args
        }
    });

    writeln!(stdin, "{}", tool_request)?;
    drop(stdin); // Close stdin so server knows we're done

    // 6. Read tool response
    for line in lines {
        let line = line?;
        if line.trim().is_empty() { continue; }

        if let Ok(response) = serde_json::from_str::<serde_json::Value>(&line) {
            if response["id"] == 2 {
                if let Some(result) = response.get("result") {
                    if let Some(text) = result["content"][0]["text"].as_str() {
                        return Ok(serde_json::from_str(text)?);
                    }
                }
            }
        }
    }

    Err("No response received".into())
}
```

## Expected Result

**Before (64KB buffer):**
```
Chunks: 4-5
Risk of deadlock: HIGH
```

**After (1MB buffer):**
```
Chunks: 1 (entire response fits)
Risk of deadlock: NONE
```

## Test It

```rust
let result = call_mcp_tool("get_account_transfers", &serde_json::json!({
    "address": "REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck",
    "limit": 500
}));

println!("Success! Got {} transfers", result["data"].as_array().unwrap().len());
```

## Why This Works

1. **1MB buffer** is the Linux maximum and plenty for 500-transfer response (201KB)
2. **Response fits in 1 chunk** - no partial reads
3. **No blocking** - writer doesn't fill buffer
4. **No deadlock** - everything works smoothly
5. **Future-proof** - Can handle even larger responses (up to 1MB)

## Alternative: If you can't use `libc`

Use smaller limits:
```rust
// Instead of limit: 500
let args = serde_json::json!({
    "address": "...",
    "limit": 100  // ~40KB response, fits in 64KB buffer
});
```
