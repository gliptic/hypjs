#!/bin/bash
unset JAVA_TOOL_OPTIONS

echo 'Calc size'

java -jar ~/bin/compiler.jar --js_output_file=src/out.js &&
	~/bin/zopfli -c src/out.js | python -uc "import sys;print('Size: ' + str(len(sys.stdin.read())))"