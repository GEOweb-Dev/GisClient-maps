var ConditionBuilder = {


    // **** baseUrl - Gisclient service URL
    baseUrl : '/gisclient',
    resourcesPath: '../resources/',

    rootCondition: '<table class="conditionbuilder">'+
            '<tr><td class="seperator" ><select><option value="and">And</option><option value="or">Or</option></select></td>' +
            '<td><div class="querystmts"><img src="'+this.resourcesPath+'themes/icons/qbuilder_del.png" alt="Remove" title="Rimuovi condizione" class="remove" /></div><div><img class="add" src="'+this.resourcesPath+'themes/icons/qbuilder_add.png" title="Aggiungi condizione" alt="Add" /> <img src="'+this.resourcesPath+'themes/icons/qbuilder_nested.png" alt="Add Nested" title="Aggiungi condizione annidata" class="addroot" /></div>' +
            '</td></tr></table>',

    operators: {
        equalto: {
            operator: '=',
            label: 'Uguale'
        },
        notequalto: {
            operator: '!=',
            label: 'Diverso'
        },
        contains: {
            operator: 'ILIKE',
            label: 'Contiene',
            wildchar: 'both'
        },
        startswith: {
            operator: 'ILIKE',
            label: 'Inizia con',
            wildchar: 'right'
        },
        endswith: {
            operator: 'ILIKE',
            label: 'Finisce con',
            wildchar: 'left'
        },
        isnull: {
            operator: 'is null',
            label: 'E\' nullo',
            noValue: true
        },
        isnotnull: {
            operator: 'is not null',
            label: 'Non è nullo',
            noValue: true
        },
        lessthan: {
            operator: '<',
            label: 'Minore'
        },
        greaterthan: {
            operator: '>',
            label: 'Maggiore'
        }
    },

    iterations: 0,
    placeHolderCount: 0,

    featureType: undefined,
    rootSelector: undefined,

    init: function(selector) {
        this.rootSelector = selector;
        this.rootCondition = '<table class="conditionbuilder">'+
                '<tr><td class="seperator" ><select><option value="and">And</option><option value="or">Or</option></select></td>' +
                '<td><div class="querystmts"><img src="'+this.resourcesPath+'themes/icons/qbuilder_del.png" alt="Remove" title="Rimuovi condizione" class="remove" /></div><div><img class="add" src="'+this.resourcesPath+'themes/icons/qbuilder_add.png" title="Aggiungi condizione" alt="Add" /> <img src="'+this.resourcesPath+'themes/icons/qbuilder_nested.png" alt="Add Nested" title="Aggiungi condizione annidata" class="addroot" /></div>' +
                '</td></tr></table>';
    },

    addQueryRoot: function(selector, isRoot, queryDef) {
        var self = this;

        var setOperator = 'and';
        var setStatements = [];
        var setNestedStatements = [];
        if (typeof(queryDef) != 'undefined') {
            if (queryDef.hasOwnProperty('operator')) {
                setOperator = queryDef.operator;
            }
            if (queryDef.hasOwnProperty('expressions')) {
                setStatements = queryDef.expressions;
            }
            if (queryDef.hasOwnProperty('nestedexpressions')) {
                setNestedStatements = queryDef.nestedexpressions;
            }

        }
        $(selector).append(self.rootCondition);
        $(selector).find('select').val(setOperator);
        var q = $(selector).find('table');
        var l = q.length;
        var elem = q;
        if (l > 1) {
            elem = $(q[l - 1]);
        }

        var tWidth = $(selector).width() ? $(selector).width() : 550;
        //If root element remove the close image
        if (isRoot) {
            elem.find('td > div >.remove').detach();
        }
        else {
            elem.find('td > div >.remove').click(function () {
                // td>tr>tbody>table
                $(this).parent().parent().parent().parent().detach();
            });
        }

        if(self.featureType) {
            var statement = self.getConditionStatement(tWidth);
            var statementsNum = setStatements.length;

            if (statementsNum == 0) {
                // Add the default staement segment to the root condition
                elem.find('td >.querystmts').append(statement);

                // Add the head class to the first statement
                elem.find('td >.querystmts div >.remove').addClass('head');
            }

            for (var k = 0; k < statementsNum; k++) {
                var statDef = setStatements[k];
                var statementIn = self.getConditionStatement(tWidth, statDef.colval, statDef.opval, statDef.val);
                // Add initialized statement segment to the root condition
                elem.find('td >.querystmts').append(statementIn);
                if (k == 0) {
                    // Add the head class to the first statement
                    elem.find('td >.querystmts div >.remove').addClass('head');
                }
            }

            var stmtsGlobal = elem.find('td >.querystmts').find('div >.remove').filter(':not(.head)');
            stmtsGlobal.unbind('click');
            stmtsGlobal.click(function () {
                $(this).parent().detach();
            });

            // Handle click for adding new statement segment
            // When a new statement is added add a condition to handle remove click.
            elem.find('td div >.add').click(function () {
                $(this).parent().siblings('.querystmts').append(statement);
                var stmts = $(this).parent().siblings('.querystmts').find('div >.remove').filter(':not(.head)');
                stmts.unbind('click');
                stmts.click(function () {
                    $(this).parent().detach();
                });
            });

            // Handle click to add new root condition
            elem.find('td div > .addroot').click(function () {
                self.addQueryRoot($(this).parent(), false);
            });

            $(this.rootSelector + ' select[useSuggest="1"]').change(function() {
                var selected = $('option:selected', this),
                    fieldId = $(selected).attr('fieldId'),
                    input = $(this).nextAll('input');

                if($(selected).attr('useSuggest') == 1) {
                    $(input).typeahead({
                        minLength: 2
                    },{
                        source: function(query, process) {
                            return $.ajax({
                                url: self.baseUrl + '/services/xSuggest.php',
                                data: {
                                    suggest: query,
                                    field_id: fieldId
                                },
                                dataType: 'json',
                                success: function(data) {
                                    return process(data.data);
                                }
                            });
                        }
                    });
                } else console.log('no input');
            });

            for (var h = 0; h < setNestedStatements.length; h++) {
                var statNDef = setNestedStatements[h];
                self.addQueryRoot(elem.find('td div > .addroot').parent(), false, statNDef);
            }

        } else console.log('no feature type');
    },

    getConditionStatement: function(cWidth, setCol, setOp, setVal) {
        var len = this.featureType.properties.length, i, field,
            options = [], fieldOption,
            operator, statement, suggest;

        statement = '<div cbcontainer="yes"><img src="'+this.resourcesPath+'themes/icons/qbuilder_del.png" alt="Remove" title="Rimuovi condizione" class="remove" />'

        suggest = false;
        for(i = 0; i < len; i++) {
            field = this.featureType.properties[i];

            if(!field.searchType && (field.resultType==4 || typeof(field.resultType) == 'undefined' || field.relationType==2)) continue;

            fieldOption = '<option value="'+field.name+'"';

            if(field.searchType == 3) {
                suggest = true;
                fieldOption += ' useSuggest="1" fieldId="'+field.fieldId+'"';
            }
            if (field.name == setCol) {
                fieldOption += ' selected';
            }
            fieldOption += '>'+field.header+'</option>';

            options.push(fieldOption);
        }
        statement += '<select class="col"';
        if(suggest) statement += ' useSuggest="1"';
        statement += '>'+options.join(' ')+'</select>';

        statement += '<select class="op">';
        for(i in this.operators) {
            if(this.operators.hasOwnProperty(i)) {
                operator = this.operators[i];
                statement += '<option value="'+i+'"';
                if (i == setOp) {
                    statement += ' selected';
                }
                statement += '>'+operator.label+'</option>';
            }
        }

        statement += '</select>';

        //var inputWidth = $(.query).width() - 210;
        var inputWidth = cWidth - 330 > 80 ? cWidth - 330 : 200;
        statement += '<input type="text" style="width:'+ inputWidth +'px;"';
        if (typeof(setVal) != 'undefined') {
            statement += ' value="' + setVal + '"';
        }
        statement += '/></div>';

        return statement;
    },

    reset: function() {
        $(this.rootSelector).empty();
    },

    setFeatureType: function(featureType, queryDef) {
        this.featureType = featureType;
        this.reset();
        this.addQueryRoot(this.rootSelector, true, queryDef);
    },

    getCondition: function(selector) {
        this.iterations++;
        if(this.iterations > 10) return console.log('troppe iterations...');

        var rootSelector = selector || $(this.rootSelector).children();
        //Get the columns from table (to find a clean way to do it later) //tbody>tr>td
        var elem = $(rootSelector).children().children().children();
        //elem 0 is for operator, elem 1 is for expressions

        var q = {};
        var expressions = [];
        var nestedexpressions = [];

        var operator = $(elem[0]).find(':selected').val();
        q.operator = operator;

        // Get all the expressions in a condition
        var expressionelem = $(elem[1]).find('> .querystmts div[cbcontainer="yes"]');
        for (var i = 0; i < expressionelem.length; i++) {
            expressions[i] = {};
            var col = $(expressionelem[i]).find('.col :selected');
            var op = $(expressionelem[i]).find('.op :selected');
            expressions[i].colval = col.val();
            expressions[i].coldisp = col.text();
            expressions[i].opval = op.val();
            expressions[i].opdisp = op.text();
            expressions[i].val = $(expressionelem[i]).find('input:not(.tt-hint)').val();
        }
        q.expressions = expressions;

        // Get all the nested expressions
        var childTables = $(elem[1]).find('table');
        if (childTables.length != 0) {
            var len = $(elem[1]).find('table').length;

            for (var k = 0; k < len; k++) {
                var tmpExpr = this.getCondition($(elem[1]).find('table')[k]);
                if (tmpExpr.expressions.length == 0 && tmpExpr.nestedexpressions.length == 0) {
                    continue;
                }
                nestedexpressions.push(tmpExpr);
            }
        }
        q.nestedexpressions = nestedexpressions;

        return q;
    },

    getQuery: function(rootCondition, rawOutput) {
        if (typeof(rawOutput) == 'undefined')
            rawOutput = false;
        if (!rootCondition)
            this.iterations = 0;
        var condition = rootCondition || this.getCondition();
        if (rawOutput)
            return condition;
        var op = [' ', condition.operator, ' '].join('');
        var values = {};

        //la costruzione della query è ben più complicata di così...
        var e = [];
        var elen = condition.expressions.length;
        for (var i = 0; i < elen; i++) {
            var expr = condition.expressions[i];
            var operator = this.operators[expr.opval].operator;
            var placeholder = ':param_' + this.placeHolderCount;
            var value = expr.val;
            if(this.operators[expr.opval].wildchar) {
                switch(this.operators[expr.opval].wildchar) {
                    case 'both':
                        value = '%'+value+'%';
                    break;
                    case 'left':
                        value = '%'+value;
                    break;
                    case 'right':
                        value = value+'%';
                    break;
                }
            }
            if(this.operators[expr.opval].noValue) {
                value = '';
                placeholder = '';
            } else {
                values['param_' +  this.placeHolderCount] = value;
                this.placeHolderCount++;
            }
            e.push(expr.colval + ' ' + operator + ' ' + placeholder);
        }

        var n = [];
        var nlen = condition.nestedexpressions.length;
        for (var k = 0; k < nlen; k++) {
            var nestexpr = condition.nestedexpressions[k];
            if (nestexpr.expressions.length == 0 && nestexpr.nestedexpressions.length == 0)
                continue;
            var result = this.getQuery(nestexpr);
            n.push(result.query);
            $.extend(values, result.values);
        }

        var q = [];
        if (e.length > 0)
            q.push(e.join(op));
        if (n.length > 0)
            q.push(n.join(op));

        return {
            query: ['(', q.join(op), ')'].join(' '),
            values: values
        };
    }
};
