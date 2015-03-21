#!/bin/bash

if [ "$1" == "gzip" ] && [ "$2" == "entr" ]; then
	unset JAVA_TOOL_OPTIONS
	python -uc "import datetime;print('-- ' + datetime.datetime.now().isoformat() + ' --')"
	java -jar ~/bin/compiler.jar --js_output_file=src/amd.min2.js --compilation_level=WHITESPACE_ONLY src/amd.min.js && 
		~/bin/zopfli -c src/amd.min2.js | python -uc "import sys;print('Size: ' + str(len(sys.stdin.read())))"
elif [ "$1" == "all" ] && [ "$2" == "entr" ]; then
	unset JAVA_TOOL_OPTIONS
	python -uc "import datetime;print('-- ' + datetime.datetime.now().isoformat() + ' --')"
	java -jar ~/bin/compiler.jar --language_in=ECMASCRIPT6 --language_out=ES5 --js_output_file=src/all.min.js build/amd.js build/transducers.js build/route.js && 
		~/bin/zopfli -c src/all.min.js | python -uc "import sys;print('Size: ' + str(len(sys.stdin.read())))"
elif [ "$2" == "entr" ]; then
	unset JAVA_TOOL_OPTIONS
	python -uc "import datetime;print('-- ' + datetime.datetime.now().isoformat() + ' --')"
	java -jar ~/bin/compiler.jar --language_in=ECMASCRIPT6 --language_out=ES5 --js_output_file=src/$1.min.js build/$1.js && 
		~/bin/zopfli -c src/$1.min.js | python -uc "import sys;print('Size: ' + str(len(sys.stdin.read())))"
else
	if [ "$1" == "gzip" ]; then
		ls build/amd.min.js | ~/bin/entr ./build.sh $1 entr
	elif [ "$1" == "all" ]; then
		ls build/*.js | ~/bin/entr ./build.sh $1 entr
	else
		ls build/$1.js | ~/bin/entr ./build.sh $1 entr
	fi
fi
