# Attack Demonstration Scripts

This directory contains Node.js scripts that demonstrate various attacks and how our E2EE system defends against them.

## Scripts

### 1. mitm_attack_demo.js
Demonstrates Man-in-the-Middle (MITM) attacks:
- Shows how plain Diffie-Hellman is vulnerable
- Shows how digital signatures prevent MITM
- Includes message interception demonstration

**Run:**
```bash
node attack-demos/mitm_attack_demo.js
```

### 2. replay_attack_demo.js
Demonstrates Replay attacks:
- Shows vulnerability without protection
- Shows triple-layer protection (nonces, timestamps, sequence numbers)
- Tests all three defense mechanisms

**Run:**
```bash
node attack-demos/replay_attack_demo.js
```

## Requirements

- Node.js 16+ (uses built-in crypto module)
- No additional dependencies needed

## Output

Each script produces detailed console output showing:
- Step-by-step attack execution
- Defense mechanism activation
- Success/failure indicators
- Summary of results

## Integration with Report

Screenshots and logs from these scripts should be included in:
- PROJECT_REPORT.md
- SECURITY_ANALYSIS.md
- ATTACK_SIMULATIONS.md

## Usage for Demonstration

1. Run scripts to generate output
2. Capture screenshots of key moments
3. Include in project documentation
4. Use during presentation to show live attacks
