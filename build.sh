#!/bin/bash

if [ "$1" == "entr" ]; then
	unset JAVA_TOOL_OPTIONS
	python -uc "import datetime;print('-- ' + datetime.datetime.now().isoformat() + ' --')"
	tsc amd.ts test.ts --module amd &&
		java -jar ~/bin/compiler.jar --js_output_file=out.js amd.js && 
		~/bin/zopfli -c out.js | python -uc "import sys;print('Size: ' + str(len(sys.stdin.read())))"
else
	ls *.ts | ~/bin/entr ./build.sh entr
fi
