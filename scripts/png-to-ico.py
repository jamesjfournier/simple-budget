#!/usr/bin/env python3
"""Wrap one PNG in a Windows .ico file. Width 0 means 256 pixels."""

import struct
import sys

png = open(sys.argv[1], "rb").read()
if png[:8] != b"\x89PNG\r\n\x1a\n":
    raise SystemExit("not a png")
ico = struct.pack("<HHH", 0, 1, 1)
ico += struct.pack("<BBBBHHII", 0, 0, 0, 0, 1, 32, len(png), 22)
ico += png
open(sys.argv[2], "wb").write(ico)
