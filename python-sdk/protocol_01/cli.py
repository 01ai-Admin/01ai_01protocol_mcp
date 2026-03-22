"""Simple CLI for the 01 Protocol Python SDK."""

import argparse
import json
import sys
from pathlib import Path

from . import create_agent, verify_from_text


def main():
    parser = argparse.ArgumentParser(prog="create-agent", description="01 Protocol CLI")
    subparsers = parser.add_subparsers(dest="command")

    # create
    create_p = subparsers.add_parser("create", help="Create a new agent identity")
    create_p.add_argument("--name", required=True)
    create_p.add_argument("--role", required=True)
    create_p.add_argument("--goal", required=True)
    create_p.add_argument("--memory", action="store_true", help="Include starter memory vault")
    create_p.add_argument("--out", help="Output file path (default: <name>.01ai)")

    # verify
    verify_p = subparsers.add_parser("verify", help="Verify a .01ai or .01bundle file")
    verify_p.add_argument("file", help="Path to .01ai or .01bundle file")

    args = parser.parse_args()

    if args.command == "create":
        result = create_agent(
            name=args.name,
            role=args.role,
            goal=args.goal,
            include_memory=args.memory,
        )
        out_path = args.out or f"{args.name.lower().replace(' ', '-')}{result['file_extension']}"
        Path(out_path).write_text(result["json"])
        print(f"✅ Agent created: {result['agent']['name']}")
        print(f"   Instance ID : {result['agent']['instanceId']}")
        print(f"   Public Key  : {result['agent']['signerPublicKey']}")
        print(f"   Saved to    : {out_path}")
        print(f"\n⚠️  PRIVATE KEY (save this — shown once):")
        print(f"   {result['private_key_hex']}")

    elif args.command == "verify":
        text = Path(args.file).read_text()
        # Handle .01bundle
        try:
            parsed = json.loads(text)
            if "identity" in parsed:
                text = json.dumps(parsed["identity"])
        except Exception:
            pass
        result = verify_from_text(text)
        if result["valid"]:
            print(f"✅ PASS — {result['agent']['name']} ({result['agent']['instanceId']})")
        else:
            print(f"❌ FAIL — {result['error']}")
            sys.exit(1)
        for w in result.get("warnings", []):
            print(f"⚠️  {w}")

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
