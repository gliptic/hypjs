/// <reference path="amd.d.ts" />

define(function() {


    /** @const */
    var DEBUG = false;
    /** @const */
    var NO_DOCUMENT_FRAGMENTS = false;

    function log(...p: any[]);
    function log() { console.log.apply(console, arguments) };

    /** @const */
    var TObject = 0;
    /** @const */
    var TOther = 1;

    function type(v): number {
        DEBUG && assert(!Array.isArray(v), 'Node cannot be an array');
        
        if (typeof v == 'object') {
            return TObject;
        } else {
            return TOther;
        }
    }

    function assert(cond, msg) {
        if (!(cond)) throw Error('Assert fail: ' + msg);
    }

    function renderNode(tag: string, oldAttr: any, newAttr: any, node: Element) {
        for (var attrName in newAttr) {
            if (attrName !== 'key') {
                var newValue = newAttr[attrName];

                if (typeof newValue == 'function') {
                    node[attrName] = newValue;
                } else if (oldAttr[attrName] !== newValue) {
                    node.setAttribute(attrName, newValue);
                } else if (attrName === 'value'
                    && tag === 'input'
                    && (node as any).value != newValue) {
                    (node as any).value = newValue;
                }
            }
        }
    }

    var doc = document;
    var emptyN = { a: {}, c: [] };

    function nodeBucket(obj): string | number {
        var ty = type(obj);
        if (ty) {
            return ty;
        } else {
            return ty + obj.t + '+' + (obj.a.id || '') + '+' + (obj.key || '') + '+' + Object.keys(obj.a);
        }
    }

    function render(oldDom: any[], newDom: any[], parentNode: Element) {
        var children = [].slice.call(parentNode.childNodes),
            childCount = children.length,
            oldChildIdx = oldDom.length - 1,
            newChildIdx = newDom.length,
            nextNode = null;

        var oldBuckets = {};

        for (var i = 0; i <= oldChildIdx; ++i) {
            var k = nodeBucket(oldDom[i]);

            if (oldBuckets[k]) oldBuckets[k].push(i); else oldBuckets[k] = [i];

            DEBUG && log('key for', i, ':', k);
        }

        while (newChildIdx-- > 0) {
            var newN = newDom[newChildIdx],
                newType = type(newN),
                oldN = emptyN,
                bucket = oldBuckets[nodeBucket(newN)],
                nodeIdx,
                node;

            if (bucket && bucket.length) {
                // There are nodes that fit the description. Pick the last one, because that one is most likely to be in the right place already.
                node = children[nodeIdx = bucket.pop()];
                oldN = oldDom[nodeIdx];
                children[nodeIdx] = null;

                if (newType && oldN !== newN) {
                    node.nodeValue = newN;
                }
            } else if (newType) {
                node = doc.createTextNode(newN);
            } else {
                DEBUG && log('Creating ' + newN.t + ' tag');
                node = doc.createElement(newN.t);
            }

            if (!newType) {
                renderNode(
                    newN.t,
                    oldN.a,
                    newN.a,
                    node);

                render(oldN.c, newN.c, node);
            }

            if (nodeIdx !== oldChildIdx) { // nodeIdx being undefined or not the current child means we need to reinsert
                parentNode.insertBefore(node, nextNode);
            }
            nextNode = node;

            // Skip removed nodes
            while (oldChildIdx >= 0 && !children[oldChildIdx]) { --oldChildIdx; }
        }

        // Remove any left-over nodes in children
        children.forEach(n => {
            if (n) {
                parentNode.removeChild(n);
                // TODO: Clean node
            }
        });
    }

    function root(node) {
        var curDom = [];
        return function(newDom) {
            render(curDom, newDom, node);
            curDom = newDom;
        }
    }

    return {
        //render: render,
        root: root
    }
})