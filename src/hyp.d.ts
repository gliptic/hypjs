declare module "hyp" {
	interface Ast {
	    //kind: AstKind;
	    //type?: AstType;
	}

	interface AstType {

	}

	interface AstLambda extends Ast {
	    //cases: Case[];
	    //scanState: ScanState;
	}

	interface AstModule extends AstLambda {
	    name: string;
	}

	function AstParser(source: string): { ruleModule(): AstModule };

	class Compiler {
		build(m: Ast): string;
	}
}