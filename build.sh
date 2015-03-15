#!/bin/bash

if [ "$2" == "entr" ]; then
	unset JAVA_TOOL_OPTIONS
	python -uc "import datetime;print('-- ' + datetime.datetime.now().isoformat() + ' --')"
	#tsc src/$1.ts --module amd &&
	#	java -jar ~/bin/compiler.jar --js_output_file=src/$1.min.js src/$1.js && 
	#	~/bin/zopfli -c src/$1.min.js | python -uc "import sys;print('Size: ' + str(len(sys.stdin.read())))"
	java -jar ~/bin/compiler.jar --js_output_file=src/$1.min.js src/$1.js && 
		~/bin/zopfli -c src/$1.min.js | python -uc "import sys;print('Size: ' + str(len(sys.stdin.read())))"
else
	ls src/$1.js | ~/bin/entr ./build.sh $1 entr
fi
