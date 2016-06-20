chrome.bookmarks.getTree(function(results) {
    var makeTreeVisitable = function(node) {
        return traverseTree(node, makeVisitable);
    }

    results.forEach(makeTreeVisitable, this);

    var visitor = createTreeVisitor();
    var elements = results.map(function(node) { 
        return node.accept(visitor); 
    });

    $('#tree').append(elements[0]);
    return;
});

function traverseTree(root, operation) {
    operation(root);

    if (root['children']) {
        root.children.forEach(function(child) {
            traverseTree(child, operation);
        }, this);
    } else {
        return [];
    }
}

function showSubTree(root) {
    var table = $('#bookmark-table');
    table.find('.row').remove();

    root.children.forEach(function(child) {
        var row = $('<tr class="row"></tr>');
        var li = $('<td></td>');
        li.text(child.title);
        row.append(li);
        table.append(row);
    });
}

function createTreeVisitor() {
    return {
        visitLeaf: function(node) {
            
        },
        visitRoot: function(node) {
            var root = $('<ul></ul>');
            var label = $('<li></li>');
            var href = $('<a></a>');
            label.append(href);
            href.text(node.title);
            href.on('click', function() {
                showSubTree(node);
            });
            root.append(label);
            
            var self = this;

            var subRoot = $('<ul></ul>');
            label.append(subRoot);

            node.children.map(function(child) {
                subRoot.append(child.accept(self));
            });

            return root;
        }
    };
}

function makeVisitable(node) {
    if (isLeaf(node)) {
        node.accept = function(visitor) {
            return visitor.visitLeaf(this);
        };
    } else {
        node.accept = function(visitor) {
            return visitor.visitRoot(this);
        }
    }
}


function getChilds(root, open, close) {
    open(root);

    if (root['children']) {
        root.children.forEach(function(child) {
            getChilds(child);
        }, this);
    } else {
        return [];
    }

    close(root);
}

function openNode(node) {
    if (isLeaf(node)) {
        printBookmark(node);
    } else {
        printDirectory(node);
    }
}

function closeNode(node) {
    if (isLeaf(node)) {
        printBookmark(node);
    } else {
        printDirectory(node);
    }
}

function printNode(node) {
    if (isLeaf(node)) {
        printBookmark(node);
    } else {
        printDirectory(node);
    }
}

function printDirectory(node) {
    var label = node.title;
    console.log('Directory: ', label);
}

function printBookmark(node) {
    var label = node.title;
    console.log(label);
}

function isInnerNode(node) {
    return node.hasOwnProperty('children');
}

function isLeaf(node) {
    return !isInnerNode(node);
}
