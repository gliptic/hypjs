/** @const */
var OP_LABEL = 0x80000000;

/** @const */
var OPC_MOVE = 0;
var OPC_ADD = 1;
var OPC_JUMP = 2;

function instr(opc: number, r: number, op1: number, op2?: number, cond?: number) {
	return (opc << 24) | ((cond || 0) << 18) | ((op2 || 0) << 12) | (op1 << 6) | r;
}

export function run() {
	var code = new Uint32Array(3);
	code[0] = instr(OPC_MOVE, 0, 8);
	code[1] = instr(OPC_ADD, 0, 0, 1, 1);
	code[2] = instr(OPC_ADD, 1, 0, 9);
	var compiled = compile(code);

	console.log(compiled);
	var f = new Function(compiled);

	var mod = f();

	var mem = new ArrayBuffer(64 * 1024);
	var instance = mod(window, {}, mem);

	//instance.run();
	console.log('ip:', instance.getip());
}

export function compile(code: Uint32Array) {
	var out = '';
	var indent = 0;

	function l(line?: string) {
		for (var i = 0; i < indent; ++i) {
			out += '  ';
		}
		out += line || '';
		out += '\n';
	}

	function c(line?: string) {
		for (var i = 0; i < indent - 1; ++i) {
			out += '  ';
		}
		out += line || '';
		out += '\n';
	}

	function b(line?: string) {
		l(line);
		++indent;
	}

	function e(line?: string) {
		--indent;
		l(line || '}');
	}

	b('return function(stdlib, foreign, mem) {');

	l('"use asm";');
	l();

	l('var U8 = new stdlib.Uint8Array(mem);');
    l('var I32 = new stdlib.Int32Array(mem);');
    l('var U32 = new stdlib.Uint32Array(mem);');

    l('var g_ip = 0, g_r0 = 0, g_r1 = 0, g_f0 = 0.0;');

	b('function run() {')
	//l('var ip = g_ip | 0;');
	l('var ip = 0, r0 = 0, r1 = 0;');
	l('var count = 20;');
	l('r0 = g_r0 | 0;');
	l('r1 = g_r1 | 0;');
	l('ip = g_ip | 0;');
	b('loop: while ((count | 0) > 0) {')

	b('switch (ip >> 0) {');

	var ip = 0;
	var inblock = false;
	var instr_count = 0;

	var validTargets = {};

	function endblock(exit?: string) {
		var next: number;

		if (inblock) {
			l('count = (count - ' + instr_count + ') | 0;');
			l('ip = ' + ip + ';');
			instr_count = 0;
			
			l(exit);

			inblock = false;
		}
	}

	function jumpToIp(newip: string) {
		l('count = (count - ' + instr_count + ') | 0;');
		l('ip = ' + newip + ';');
		l('break;');
	}

	function writeOpr(op: number, v: string): string {
		if (op < 8) {
			return 'r' + op + ' = ' + v + ';';
		} else {
			return 'U32[' + op + '] = ' + v + ';';
		}
	}

	function readOpr(op: number): string {
		if (op < 8) {
			return 'r' + op;
		} else {
			return '(U32[' + op + '] | 0)';
		}
	}

	for (; ip < code.length;) {
		if ((ip & 0xff) === 0 || (code[ip] & OP_LABEL)) {
			if (op & OP_LABEL)
				validTargets[ip] = true;
			endblock('break;');
		}

		var op = code[ip];
		var opc = (op >> 24) & 0x7f;
		var rr = (op & 0x3f);
		var opr1 = (op >> 6) & 0x3f;
		var opr2 = (op >> 12) & 0x3f;
		var cond = (op >> 18) & 0xf;

		if (!inblock) {
			c('case ' + ip + ':');
			inblock = true;
		}

		++ip;
		++instr_count; // NOTE: Do this before any kind of endblock is triggered

		// 6:6:6

		var r, v1, v2;

		if (cond) {
			b('if ((r' + (cond - 1) + ' | 0) != 0) {')
		}

		switch (opc) {
			case OPC_JUMP:
				r = readOpr(rr);
				jumpToIp(r);
				break;
			case OPC_ADD:
				v2 = readOpr(opr2);
			case OPC_MOVE:
				v1 = readOpr(opr1);
				
				switch (opc) {
					case OPC_ADD:
						r = '(' + v1 + ' + ' + v2 + ') | 0';
						break;
					case OPC_MOVE:
						r = v1;
						break;
				}

				l(writeOpr(rr, r));
				break;
		}

		if (cond) {
			e();
		}

/*
		if (opc === 1) {
			b('if ((r0 & 1) == 0) {');

			var jumpdest = 2;

			jumpToIp(jumpdest);
			e();
		} else if (opc === 2) {
			l('r0 = (r0 + 1) | 0;');
		} else if (opc === 3) {
			l('r0 = (r0 - 1) | 0;');
		}*/
	}

	ip = 0; // Loop
	endblock('break;');

	// TODO: Validate static jumps against validTargets

	c('default:');
	l('break loop;');

	e(); // switch

	e(); // while

	l('g_ip = ip;');

	e(); // function run

	b('function getip() {');
	l('return g_ip >> 0;');
	e();

	l('return { run: run, getip: getip };')

	e(); // function cpu

	return out;
}

export function compile2(code: Uint32Array) {
	var out = '';
	var indent = 0;

	function l(line?: string) {
		for (var i = 0; i < indent; ++i) {
			out += '  ';
		}
		out += line || '';
		out += '\n';
	}

	function c(line?: string) {
		for (var i = 0; i < indent - 1; ++i) {
			out += '  ';
		}
		out += line || '';
		out += '\n';
	}

	function b(line?: string) {
		l(line);
		++indent;
	}

	function e(line?: string) {
		--indent;
		l(line || '}');
	}

	b('return function(stdlib, foreign, mem) {');

	l('"use asm";');
	l();

	l('var U8 = new stdlib.Uint8Array(mem);');
    l('var I32 = new stdlib.Int32Array(mem);');
    l('var U32 = new stdlib.Uint32Array(mem);');

    l('var g_ip = 0, g_r0 = 0, g_f0 = 0.0;');

	b('function run() {')
	l('var ip = g_ip | 0;');
	l('var r0 = g_r0 | 0;');
	l('var count = 20;');
	b('loop: while ((count | 0) > 0) {')

	b('switch (ip >> 0) {');

	var ip = 0;
	var inblock = false;
	var instr_count = 0;
	var entered = new Uint8Array(code.length);

	var forwardjumps = {};
	var forwardjumpdest = [];
	var labelqueue = [];

	function endblock(exit?: string): boolean {
		var next: number;

		if (inblock) {
			l('count = (count - ' + instr_count + ') | 0;');
			l('ip = ' + ip + ';');
			instr_count = 0;
			
			l(exit);

			while (forwardjumpdest.length > 0) {
				e();
				var dest = forwardjumpdest.pop();

				/*
				if (!entered[dest]) {
					ip = dest;
					return true;
				} else*/ {
					jumpToIp(dest);
					//labelqueue.push(dest);
				}
			}

			inblock = false;
		}

		if (labelqueue.length == 0) {
			return false;
		} else {
			ip = labelqueue.pop();
		}

		return true;
	}

	function jumpToIp(newip: number) {
		l('count = (count - ' + instr_count + ') | 0;');
		l('ip = ' + ip + ';');
		l('break;');
	}

	for (;;) {
		while (forwardjumpdest.length > 0 && forwardjumpdest[forwardjumpdest.length - 1] === ip) {
			e();
			forwardjumpdest.pop();
		}

		if (ip >= code.length || entered[ip]) {
			if (ip >= code.length) {
				ip = 0;
			}

			if (!endblock('break;'))
				break;
		} else {
			if ((ip & 0xff) === 0
			 || (op & OP_LABEL)) {
				// Force previous block to end
				if (!endblock('break;'))
					break;
			}

			var op = code[ip];

			if (!inblock) {
				c('case ' + ip + ':');
				entered[ip] = 1;
				inblock = true;
			}

			++ip;
			++instr_count; // NOTE: Do this before any kind of endblock is triggered

			// Decode instruction

			if (op === 1) {
				b('if ((r0 & 1) == 0) {');

				var jumpdest = 2;

				// ip   jumpdest   jumpdest < ip
				// no   no         no               if (!c) { ip: ... } jumpdest: ...
				// yes  no         no               if (!c) { goto ip } jumpdest: ...
				// yes  no         yes              if (c) { goto jumpdest } goto ip
				// yes  yes        yes              if (c) { goto jumpdest } goto ip
				// yes  yes        no               if (c) { goto jumpdest } goto ip
				// no   no         yes              if (c) { goto jumpdest } ip: ...
				// no   yes        yes              if (c) { goto jumpdest } ip: ...
				// no   yes        no               if (c) { goto jumpdest } ip: ...

				// ja b
				// add
				// ja c
				// add
				// b:
				// sub
				// c:

				if (!entered[jumpdest] && jumpdest < ip) {
					// TODO: Reverse condition
					if (entered[ip]) {
						// if (!c) { goto ip } jumpdest: ...
					} else {
						// if (!c) { ip: ... } jumpdest: ...

						if (forwardjumpdest.length === 0 || forwardjumpdest[forwardjumpdest.length - 1] >= jumpdest) {
							// Forward jump using {}
							forwardjumpdest.push(jumpdest);
						}
					}
				} else {
					jumpToIp(jumpdest);
					if (!entered[jumpdest]) labelqueue.push(jumpdest);
					e();
				}

				if (jumpdest < ip) {
					jumpToIp(jumpdest);
					if (!entered[jumpdest]) labelqueue.push(jumpdest);
					e();
				} else if (forwardjumpdest.length === 0 || forwardjumpdest[forwardjumpdest.length - 1] >= jumpdest) {
					// Forward jump using {}
					forwardjumpdest.push(jumpdest);
				} else if (!entered[jumpdest]) {
					jumpToIp(jumpdest);
					e();
				} else {
					// TODO: Reverse condition
					// Normal jump
					// TODO: Make sure jumpdest is/will be generated
					jumpToIp(jumpdest);
					e();
				}
			} else if (op === 2) {
				l('r0 = (r0 + 1) | 0;');
			} else if (op === 3) {
				l('r0 = (r0 - 1) | 0;');
			}
		}
	}

	c('default:');
	l('break loop;');

	e(); // switch

	e(); // while

	l('g_ip = ip;');

	e(); // function run

	b('function getip() {');
	l('return g_ip >> 0;');
	e();

	l('return { run: run, getip: getip };')

	e(); // function cpu

	return out;
}