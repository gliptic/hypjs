#!/bin/bash

if [ "$1" == "entr" ]; then
	unset JAVA_TOOL_OPTIONS
	python -uc "import datetime;print('-- ' + datetime.datetime.now().isoformat() + ' --')"
	tsc src/amd.ts --module amd &&
		java -jar ~/bin/compiler.jar --js_output_file=src/amd.min.js src/amd.js && 
		~/bin/zopfli -c src/amd.min.js | python -uc "import sys;print('Size: ' + str(len(sys.stdin.read())))"
else
	ls src/*.ts | ~/bin/entr ./build.sh entr
fi
