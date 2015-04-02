//import _ = require("transducers")

define(function() {


    /** @const */
    var DEBUG = false;
    /** @const */
    var NO_DOCUMENT_FRAGMENTS = false;

    function log(...p: any[]);
    function log() { console.log.apply(console, arguments) };

    /** @const */
    var TArray = 0;
    /** @const */
    var TObject = 1;
    /** @const */
    var TOther = 2;

    function type(v): number {
        if (Array.isArray(v)) {
            return TArray;
        } else if (typeof v == 'object') {
            return TObject;
        } else {
            return TOther;
        }
    }

    function assert(cond, msg) {
        if(!(cond)) throw Error('Assert fail: ' + msg); 
    }

    function renderNode(tag: string, oldAttr: any, newAttr: any, node: Element) {
        for (var attrName in newAttr) {
            var newValue = newAttr[attrName];
            var oldValue = oldAttr[attrName];
            if (!(attrName in oldAttr) || oldValue !== newValue) {
                if (attrName === 'key')
                    continue;

                node.setAttribute(attrName, newValue);
            } else if (attrName === 'value'
                    && tag === 'input'
                    && (<any>node).value != newValue) {
                (<any>node).value = newValue;
            }
        }
    }

    var doc = document;

    function render(oldDom: any[], newDom: any[], parentNode: Element, oldParentNode?: Element) {
        var children = [].slice.call((oldParentNode || parentNode).childNodes),
            childCount = children.length,
            newChildCount = newDom.length,
            newChild = newChildCount,
            oldChild = childCount - 1,
            detachedChildren = Array(children.length);

        // The current element list is children[0 .. oldChild] ++ [nextNode]

        //assert(childCount === oldDom.length, "DOM has the wrong number of nodes");

        var nextNode = null, nextNodeInFrag = null;
        var docFrag;

        while (newChild-- > 0) {
            // Compare oldDom[newChild] and newDom[oldChild]
            // TODO: If there is a key, and newDom[newChild].key !== oldDom[oldChild].key,
            // find the element with the key in oldDom and compare against that instead.

            var oldMatchChild = oldChild;

            var oldN = oldDom[oldMatchChild],
                newN = newDom[newChild];

            var oldType = type(oldN),
                newType = type(newN);

            // TODO: Set oldNode to a suitable node that is likely to still
            // have mostly the same children. We should only do this if we have the key.
            var node = null, oldNode = null, notAttached = !!oldParentNode; // If children are taken from old node, they will not be attached

            if (oldN) {
                if ((oldType == TObject && newType == TObject 
                 && oldN.tag == newN.tag
                 && '' + Object.keys(oldN.attr) == '' + Object.keys(newN.attr)
                 && oldN.attr.id == newN.attr.id
                 && children[oldMatchChild])
                || (oldType == TOther && newType == TOther)) {
                    // Reuse
                    DEBUG && log('Reuse ' + newN.tag + ' node');
                    node = children[oldMatchChild];
                    children[oldMatchChild] = null;

                    if (oldMatchChild != oldChild) {
                        // The node is not in the right place, we need to move it.
                        // insertBefore will detach it for us, however.
                        // parentNode.removeChild(node);
                        notAttached = true;
                    }
                } else {
                    // We're guessing here whether the mismatch is because a node was
                    // removed/updated or inserted.
                    // TODO: If we have a key, we will know with more certainty.
                    if (newChild <= oldChild) {
                        
                        DEBUG && log('Removing node presumed unused');
                        parentNode.removeChild(children[oldMatchChild]);
                        detachedChildren[oldMatchChild] = children[oldMatchChild];
                        children[oldMatchChild] = null;
                    }
                    
                }
            }

            // Skip removed nodes
            while (oldChild >= 0 && !children[oldChild]) { --oldChild; }

            if (!node) {
                if (newType == TOther) {
                    node = doc.createTextNode(newN);
                } else {
                    DEBUG && log('Creating ' + newN.tag + ' tag');
                    node = doc.createElement(newN.tag);
                }
                notAttached = true;
            } else if (newType == TOther && oldN.valueOf() !== newN.valueOf()) {
                node.nodeValue = newN;
            }

            if (newType != TOther) {
                renderNode(
                    newN.tag,
                    oldN ? oldN.attr : {},
                    newN.attr,
                    node);

                if (newN.children) {
                    // TODO: If the node was recreated,
                    // we can pass its old children as cached nodes.
                    render(oldN.children, newN.children, node, oldNode);
                }
            }

            if (NO_DOCUMENT_FRAGMENTS) {
                if (notAttached) {
                    parentNode.insertBefore(node, nextNode);
                }
                nextNode = node;
            } else {
                if (notAttached) {
                    if (!docFrag) {
                        docFrag = doc.createDocumentFragment();
                        nextNodeInFrag = null;
                    }

                    //parentNode.insertBefore(node, nextNode);
                    docFrag.insertBefore(node, nextNodeInFrag);
                    nextNodeInFrag = node;
                } else {
                    if (nextNodeInFrag) {
                        parentNode.insertBefore(docFrag, nextNode);
                        //docFrag = null;
                    }
                    nextNodeInFrag = null;
                    nextNode = node;
                }
            }
        }

        if (nextNodeInFrag) {
            parentNode.insertBefore(docFrag, nextNode);
        }

        // Remove any left-over nodes in children

        detachedChildren.forEach(n => {
            // TODO: Clean node
        });
        children.forEach(n => {
            if (n) {
                parentNode.removeChild(n);
                // TODO: Clean node
            }
        });
    }

    function root(node) {
        var curDom = [];
        return function (newDom) {
            render(curDom, newDom, node);
            curDom = newDom;
        }
    }

    return {
        render: render,
        root: root
    }
})