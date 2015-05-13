/**
 * @class jsWorkflow.Instance
 * 
 * Net editor. Used to create / modify / view workflow nets.
 * 
 * Inspired by [http://github.com/hemantsshetty/jsWorkflow][1]
 * 
 * [1]: http://github.com/hemantsshetty/jsWorkflow
 */
var jsWorkflow = jsWorkflow || {};

// Leveraging the ready function of jsPlumb.
jsWorkflow.ready = jsPlumb.ready;

// Self execute this code
(function() {
	
    // No API call should be made until the DOM has been initialized.
    jsWorkflow.ready(function() {
        /**
         *Create a workflow instance.
         *@constructor Instance
         */
        jsWorkflow.Instance = function() {

            // Get a new instance of jsPlumb.
            this.instance = jsPlumb.getInstance();
        };
        
        /**
         *Initialize the workflow instance.
         *@method init
         *@param {String} workflowData Id of an HTML container within which the worlflow is to be rendered
         *@param {Object} veda global "veda" instance
         *@param {veda.IndividualModel} net individual of rdfs:type "v-wf:Net"
         *return {Object} instance Returns an initialized instance of the workflow object
         */
        jsWorkflow.Instance.prototype.init = function(workflowData, veda, net) {

            var 	instance,
                    windows,
                    addNewState,
                    bindStateEvents,
                    workflow,
                    canvasSizePx=10000,                    
                    currentScale=1.0,
                    process,
                    mode='view',
                    max_process_depth=0;
            
            if (net.hasValue('rdf:type')) {
            	if (net['rdf:type'][0].id == 'v-wf:Net') {
            		mode='edit';
            	}
            	if (net['rdf:type'][0].id == 'v-wf:Process') {
            		mode='view';
            		process = net;
            		net = (net.hasValue('v-wf:instanceOf'))?net['v-wf:instanceOf'][0]:[];
            	}
            }

            if (typeof workflowData === 'object') {
                workflow = workflowData.container;
                jsWorkflow.Instance.createWorkflowDOM(workflowData);
            } else {
                workflow = workflowData;
            }
            net['offsetX'] = localStorage.getItem("workflow"+net.id+"-offsetX");
            net['offsetY'] = localStorage.getItem("workflow"+net.id+"-offsetY");
            
            if (!net['offsetX']) {
            	net['offsetX'] = 0;
            }
            if (!net['offsetY']) {
            	net['offsetY'] = 0;
            }
            
            $('#'+workflowData).css({
       			'height': canvasSizePx +'px',
       			'width': canvasSizePx+'px',
       			'left': (-net['offsetX']-canvasSizePx/2)+'px',
       			'top': (-net['offsetY']-canvasSizePx/2)+'px',
       		});
        	$('body').css('height','100vh');
        	$('#main').addClass('calculated-height');
        	$('#'+workflowData).draggable({
                drag: function (event, ui) {
                  localStorage.setItem("workflow"+net.id+"-offsetX", -ui.position.left-canvasSizePx/2);
                  localStorage.setItem("workflow"+net.id+"-offsetY", -ui.position.top-canvasSizePx/2); 
              	  $("#workflow-context-menu").hide();
                }
            }).on("click", function() {
            	$("#workflow-context-menu").hide();
            });

            instance = this.instance;

            // Import all the given defaults into this instance.
            instance.importDefaults({
                Endpoint: ["Dot", {
                        radius: 0.1
                    }],
                HoverPaintStyle: {
                    strokeStyle: "#6699FF",
                    lineWidth: 2
                },
                ConnectionOverlays: [
                    ["Arrow", {
                            location: 1,
                            id: "arrow",
                            length: 14,
                            foldback: 0.8
                        }],
                    ["Label", {
                            label: "transition",
                            id: "label",
                            cssClass: "aLabel"
                        }]
                ],
                Container: workflow // Id of the workflow container.
            });

            // Bind a click listener to each transition (connection). On double click, the transition is deleted.
            instance.bind("dblclick", function(transition) {            	 
                 if (mode=='edit' && confirm('Delete Flow?')) {
                	 net['v-wf:consistsOf'] = veda.Util.removeSubIndividual(net, 'v-wf:consistsOf', transition.id);
                	 veda.Util.forSubIndividual(net, 'v-wf:consistsOf', transition.sourceId, function (el) {
                		 el['v-wf:hasFlow'] = veda.Util.removeSubIndividual(el, 'v-wf:hasFlow', transition.id);
                	 });
                	 instance.detach(transition);
                 }
            });
            
            // Fill info panel on flow click
            instance.bind("click", function(transition) {
            	var _this = this, currentElement = $(_this), properties;
                properties = $('#workflow-selected-item');
                $('#'+properties.find('#workflow-item-id').val()).removeClass('w_active');
                
                if (transition.id == '__label') {
                	transition = transition.component;
                }
                
                properties.find('#workflow-item-id').val(transition.id);
                properties.find('#workflow-item-type').val('flow');
                // properties.find('#workflow-item-label').val(transition.getLabel());
                currentElement.addClass('w_active');                
               	// $('.task-buttons').hide();
            });
            
            // Handle creating new flow event
            instance.bind("connection", function(info) {
            	if (info.connection.id.indexOf('con')==-1) {
            		return; // Don't use logic when we work with flows that already exists
            	}
                var individual = new veda.IndividualModel(); // create individual (Task / Condition) 
                individual.defineProperty("rdf:type");
                individual.defineProperty("rdfs:label");                
                individual.defineProperty("v-wf:flowsInto");
                
                individual["rdf:type"] = [veda.ontology["v-wf:Flow"]];
                individual["rdfs:label"] = [new String('')];
                
                net['v-wf:consistsOf'] = net['v-wf:consistsOf'].concat([individual]); // <- Add new Flow to Net
                
                veda.Util.forSubIndividual(net, 'v-wf:consistsOf', info.sourceId, function(el) {
                	if (!('v-wf:hasFlow' in el)) {
        				el.defineProperty('v-wf:hasFlow');
        			}
        			el['v-wf:hasFlow'] = el['v-wf:hasFlow'].concat([individual]); // <- Add new Flow to State
                });
                
                veda.Util.forSubIndividual(net, 'v-wf:consistsOf', info.targetId, function(el) {
                	 individual["v-wf:flowsInto"] = [el]; // setup Flow source
                });
                
                info.connection.id = individual.id;
            });

            updateSVGBackground = function(item) {
                var svgBackground = "";
                if (item.hasClass('split-and')) {
                    svgBackground += "<line x1='80' y1='25' x2='100' y2='0' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='80' y1='0' x2='80' y2='50' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='80' y1='25' x2='100' y2='50' style='stroke:rgb(0,0,0); stroke-width:1' />";
                }
                if (item.hasClass('split-or')) {
                    svgBackground += "<line x1='100' y1='25' x2='90' y2='0' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='90' y1='0' x2='80' y2='25' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='80' y1='0' x2='80' y2='50' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='100' y1='25' x2='90' y2='50' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='90' y1='50' x2='80' y2='25' style='stroke:rgb(0,0,0); stroke-width:1' />";
                }
                if (item.hasClass('split-xor')) {
                    svgBackground += "<line x1='100' y1='25' x2='80' y2='0' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='80' y1='0' x2='80' y2='50' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='100' y1='25' x2='80' y2='50' style='stroke:rgb(0,0,0); stroke-width:1' />";
                }
                if (item.hasClass('join-and')) {
                    svgBackground += "<line x1='20' y1='25' x2='0' y2='0' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='20' y1='0' x2='20' y2='50' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='20' y1='25' x2='0' y2='50' style='stroke:rgb(0,0,0); stroke-width:1' />";
                }
                if (item.hasClass('join-or')) {
                    svgBackground += "<line x1='0' y1='25' x2='10' y2='0' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='10' y1='0' x2='20' y2='25' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='20' y1='0' x2='20' y2='50' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='0' y1='25' x2='10' y2='50' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='10' y1='50' x2='20' y2='25' style='stroke:rgb(0,0,0); stroke-width:1' />";
                }
                if (item.hasClass('join-xor')) {
                    svgBackground += "<line x1='0' y1='25' x2='20' y2='0' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='20' y1='0' x2='20' y2='50' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='0' y1='25' x2='20' y2='50' style='stroke:rgb(0,0,0); stroke-width:1' />";
                }
                svgBackground = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' version='1.1' preserveAspectRatio='none' viewBox='0 0 100 50'>" + svgBackground + "</svg>\")";
                item.css('background', svgBackground);
            };
            
            showProcessRunPath = function(workItem, depth) {
            	if (workItem.hasValue('v-wf:previousWorkItem')) {
            		workItem['v-wf:previousWorkItem'].forEach(function(previousWorkItem) {
            			if (workItem.hasValue('v-wf:forNetElement') && previousWorkItem.hasValue('v-wf:forNetElement')) {
            				showProcessRunPath(previousWorkItem, depth+1);
            				instance.select({target:workItem['v-wf:forNetElement'][0].id, source:previousWorkItem['v-wf:forNetElement'][0].id}).each(function(e) {
            					e.addClass('process-path-highlight');
            					e.setLabel(((e.getLabel()!='')?e.getLabel()+',':'')+(max_process_depth-depth));
            				});
            			}
            		});
            	} else {
            		max_process_depth = depth;
            	}
            };
            
            /**
             *Bind required functional to State elements
             *@method bindStateEvents
             *@param {Object} windows List of all State elements
             */
            bindStateEvents = function(windows) {

                windows.bind("click", function(e) {

                	instance.repaintEverything();
                	
                    var _this = this, currentElement = $(_this), properties, itemId;
                    properties = $('#workflow-selected-item');
                                        
                    $('#'+veda.Util.escape4$(properties.find('#workflow-item-id').val())).removeClass('w_active'); // deactivate old selection
                    properties.find('#workflow-item-id').val(_this.id);
                    properties.find('#workflow-item-type').val('state');
                    currentElement.addClass('w_active');
                    
                	// build run path
                    if (mode=='view') {
                		instance.select().removeClass('process-path-highlight').setLabel('');
                		// If we have more then one WorkItem - we must choose among them 
                    	if (currentElement.attr('work-items-count')>1) {
                    		e.type = 'contextmenu';
                    		currentElement.trigger(e, 'leftmousebutton');
                    	} else { 
                        	var s = new veda.IndividualModel();
    	                	s["rdf:type"]=[ veda.ontology["v-fs:Search"] ];
    	                	s.search("'rdf:type' == 'v-wf:WorkItem' && 'v-wf:forProcess' == '"+process.id+"' && 'v-wf:forNetElement'=='"+_this.id+"'");
    	                	for (var el in s.results) {
    	                	    if (s.results.hasOwnProperty(el)) {
    	                	    	showProcessRunPath(new veda.IndividualModel(el), 0);
    	                	    }
    	                	}
                    	}
                    }
                });
                
                if (mode=='view') {
	                windows.bind("contextmenu", function(e, extra) {
	                	var _this = this,
	                	    menu = $("#workflow-context-menu ul");
	                	menu.html('');
	                	
	                	var s = new veda.IndividualModel();
	                	s["rdf:type"]=[ veda.ontology["v-fs:Search"] ];
	                	s.search("'rdf:type' == 'v-wf:WorkItem' && 'v-wf:forProcess' == '"+process.id+"' && 'v-wf:forNetElement'=='"+_this.id+"'");
	                	for (var el in s.results) {
	                	    if (s.results.hasOwnProperty(el)) {
	                	       var wi =  new veda.IndividualModel(el);
	                     	   var $item = $("<li/>").appendTo(menu);
	                     	   if (extra === undefined) {
	                     		   $("<a/>", {
	                     			   "text" : (wi.hasValue('rdfs:label')?wi['rdfs:label'][0]:wi.id), 
	                     			   "href" : '#/individual/'+wi.id+'/#main'
	                     		   }).appendTo($item);
	                     	   } else {
	                     		  $("<a/>", {
	                     			   "text" : (wi.hasValue('rdfs:label')?wi['rdfs:label'][0]:wi.id), 
	                     			   "href" : '#',
	                     			   "click" : (function (wi) {
	                						return function (event) {
	                							event.preventDefault();
	                							$("#workflow-context-menu").hide();
	                							showProcessRunPath(new veda.IndividualModel(''+wi.id), 0);
	                						};
	                					})(wi)
	                     		   }).appendTo($item);
	                     	   }
	                	    }
	                	}
	                	// 	                	
	                	$contextMenu.css({
	                	   display: "block",
	                	   left: e.pageX-((e.pageX+$contextMenu.width()>$( document ).width())?$contextMenu.width():0),
	                	   top: e.pageY-((e.pageY+$contextMenu.height()>$( document ).height())?$contextMenu.height():0)
	                	});
	                	return false;
	                });
                }
                if (mode=='edit') {
	                windows.bind("contextmenu", function(e) {
	                	var _this = this,
	                	    menu = $("#workflow-context-menu ul");
	                	menu.html('');
	                	// Add starting mappings to context menu
	                	veda.Util.forSubIndividual(net, 'v-wf:consistsOf', _this.id, function (el) {
	                	  if (el.hasValue('v-wf:startingMapping')) {
	                	     el['v-wf:startingMapping'].forEach(function(var_map) {
	                    	   var $item = $("<li/>").appendTo(menu);
	                	       var varId = null;
	                	       var_map['v-wf:mapToVariable'].forEach(function(var_var) {
	                	    	   varId = var_var.id;
	               	    		   $("<a/>", { 
	               	    			   "text" : (var_var.hasValue('v-wf:variableName')?var_var['v-wf:variableName'][0]:var_var.id), 
	               	    			   "href" : "#/individual/"+var_var.id+"/#main//edit"
	               	    		   }).appendTo($item);
	            	    	   });
	                	       $("<span/>", {"text": " <<< "}).appendTo($item);
	                	       var_map['v-wf:mappingExpression'].forEach(function(map_exp) {
	                	    	   $("<a/>", { 
	               	    			   "text" : map_exp, 
	               	    			   "href" : "#/individual/"+var_map.id+"/#main//edit"
	               	    		   }).appendTo($item);
	                	    	   $("<span/>", {
	                					"click": (function (instance) {
	                						return function (event) {
	                							event.preventDefault();
	                							instance.removeVarProperty(_this.id, varId, var_map.id);
	                							$(_this).trigger('contextmenu');
	                						};
	                					})(instance), 
	               	    			   "href" : ""
	               	    		   }).attr("class", "btn btn-default glyphicon glyphicon-remove button").attr("style", "padding: 3px;").appendTo($item);
	                	       });
	                        });
	                	  }
	                	  // Add completed mappings to context menu
	                	  if (el.hasValue('v-wf:completedMapping')) {
	                 	     el['v-wf:completedMapping'].forEach(function(var_map) {
	                     	   var $item = $("<li/>").appendTo(menu);
	                 	       var varId = null;
	                 	       var_map['v-wf:mappingExpression'].forEach(function(map_exp) {
	                 	    	   $("<a/>", { 
	                	    			   "text" : map_exp, 
	                	    			   "href" : "#/individual/"+var_map.id+"/#main//edit"
	                	    		   }).appendTo($item);
	                     	       $("<span/>", {"text": " >>> "}).appendTo($item);
	                     	       var_map['v-wf:mapToVariable'].forEach(function(var_var) {
	                     	    	   varId = var_var.id;
	                    	    		   $("<a/>", { 
	                    	    			   "text" : (var_var.hasValue('v-wf:variableName')?var_var['v-wf:variableName'][0]:var_var.id), 
	                    	    			   "href" : "#/individual/"+var_var.id+"/#main//edit"
	                    	    		   }).appendTo($item);
	                 	    	   });
	                 	    	   $("<span/>", {
	                 					"click": (function (instance) {
	                 						return function (event) {
	                 							event.preventDefault();
	                 							instance.removeVarProperty(_this.id, varId, var_map.id);
	                 							$(_this).trigger('contextmenu');
	                 						};
	                 					})(instance), 
	                	    			   "href" : ""
	                	    		   }).attr("class", "btn btn-default glyphicon glyphicon-remove button").attr("style", "padding: 3px;").appendTo($item);
	                 	       });
	                         });
	                 	  }
	                	  // Add executors to context menu
	                	  if (el.hasValue('v-wf:executor')) {
	                       el['v-wf:executor'].forEach(function(el2) {
	                    	   var variable = new veda.IndividualModel(el2.id);
	                    	   var $item = $("<li/>").appendTo(menu);
	                    	   $("<a/>", {
	                    		   "text" : 'EXECUTOR : '+(el2.hasValue('rdfs:label')?el2['rdfs:label'][0]:el2.id), 
	           	    			   "href" : '#/individual/'+el2.id+'/#main//edit'
	                    	   }).appendTo($item);
	            	    	   $("<span/>", {
	           						"click": (function (instance) {
	           							return function (event) {
	           								event.preventDefault();
	           								instance.removeExecutorProperty(_this.id, el2.id);
	           								$(_this).trigger('contextmenu');
	           							};
	           						})(instance), 
	          	    			   "href" : ""
	          	    		   }).attr("class", "btn btn-default glyphicon glyphicon-remove button").attr("style", "padding: 3px;").appendTo($item);
	                       });
	                	  }
	               	 	});
	                    
	                	// Button for add new input variable to task
	             	    var $item = $("<li/>").appendTo(menu);
	     	    	    $("<span/>", {
	     	    	    	"text" : "IN VAR",
	    					"click": (function (instance) {
	    						return function (event) {
	    							event.preventDefault();
	    							instance.addVarProperty(_this.id, 'input');
	    							$(_this).trigger('contextmenu');
	    						};
	    					})(instance), 
	   	    			   "href" : ""
	   	    		    }).attr("class", "btn btn-default glyphicon glyphicon-plus").appendTo($item);
	     	    	    
	                	// Button for add new output variable to task
	     	    	    $("<span/>", {
	     	    	    	"text" : "OUT VAR",
	    					"click": (function (instance) {
	    						return function (event) {
	    							event.preventDefault();
	    							instance.addVarProperty(_this.id, 'output');
	    							$(_this).trigger('contextmenu');
	    						};
	    					})(instance), 
	   	    			   "href" : ""
	   	    		    }).attr("class", "btn btn-default glyphicon glyphicon-plus").appendTo($item);
	     	    	    
	                	// Button for add new executor to task
	    	    	    $("<span/>", {
	    	    	    	"text" : "EXECUTOR",
	    	    	    	"click": (function (instance) {
	    	    	    		return function (event) {
	    	    	    			event.preventDefault();
	    	    	    			instance.addExecutorProperty(_this.id);
	    	    	    			$(_this).trigger('contextmenu');
	    	    	    		};
	    	    	    	})(instance), 
	  	    			   "href" : ""
	  	    		    }).attr("class", "btn btn-default glyphicon glyphicon-plus").appendTo($item);
	                	
	                	// 
	                	$contextMenu.css({
	                	   display: "block",
	                	   left: e.pageX-((e.pageX+$contextMenu.width()>$( document ).width())?$contextMenu.width():0),
	                	   top: e.pageY-((e.pageY+$contextMenu.height()>$( document ).height())?$contextMenu.height():0)
	                	});
	                	return false;
	                });
	
	                // Bind a click listener to each State elements. On double click, State elements are deleted.
	                windows.bind("dblclick", function() {
	                    var _this = this;
	                	riot.route("#/individual/" + $(_this).attr('id')+"/#main//edit", true);
	                });
	
	                // Initialize State elements as draggable.  
	                instance.draggable(windows, {
	                  drag: function (event, ui) { //gets called on every drag
	                	  $("#workflow-context-menu").hide();
	                      veda.Util.forSubIndividual(net, 'v-wf:consistsOf', event.target.id, function(el) {
	              			  el['v-wf:locationX'] = [new Number(Math.round(ui.position.left-canvasSizePx/2))];
	            			  el['v-wf:locationY'] = [new Number(Math.round(ui.position.top-canvasSizePx/2))];
	                      });
	                  }
	            	});
                }

                // Initialize all State elements as Connection sources.
                instance.makeSource(windows, {
                    filter: ".ep",
                    anchor: ["Continuous", { faces:[ "top", "left", "right" ] } ],
                    connector: [
						"Straight", {
                    	stub: 30,
                        gap: 0
						}
                    ],
                    connectorStyle: {
                        strokeStyle: "#666666",
                        lineWidth: 1,
                        outlineColor: "transparent",
                        outlineWidth: 4
                    },
                    maxConnections: 20,
                    onMaxConnections: function(info, e) {
                        alert("Maximum connections (" + info.maxConnections + ") reached");
                    }
                });

                // Initialize all State elements as connection targets.
                
                instance.makeTarget(windows, {
                    dropOptions: {
                        hoverClass: "dragHover"
                    },
                    anchor: ["Continuous", { faces:[ "top", "left", "right" ] } ]
                });
            };

            // Add new State event.
            jsPlumb.getSelector(".create-state").bind("click", function() {
                var _this = this,
                        stateName,
                        stateId,
                        stateElement, 
                        individual = new veda.IndividualModel(); // create individual (Task / Condition) 
                                
                individual.defineProperty("rdf:type");
                individual.defineProperty("rdfs:label");
                individual.defineProperty("v-wf:locationX");
                individual.defineProperty("v-wf:locationY");

                stateName = prompt("Enter name of the state");
                
                individual['rdfs:label'] = [new String(stateName.replace(/[^a-zA-Z0-9 ]/g, ''))];
                individual['v-wf:locationX'] = [new Number(1)];
                individual['v-wf:locationY'] = [new Number(1)];
                
                if ($('#'+workflowData).find('#' + individual.id).length < 1) {

                   	if ($(_this).hasClass('create-condition')) {
                   		individual["rdf:type"] = [veda.ontology["v-wf:Condition"]];
                    	instance.createState(individual);
                    } else { 
                        individual["rdf:type"] = [veda.ontology["v-wf:Task"]];
                    	instance.createState(individual);
                    }

                   	net['v-wf:consistsOf'] = net['v-wf:consistsOf'].concat([individual]); // <- Add new State to Net	
                    $('#' + individual.id).click();
                } else {
                    alert('This state is already present.');
                }
                $(this).blur();
            });
            
            /**
             * @method
             * Change current scale.
             * @param scale new scale
             */
            instance.changeScale = function(scale) {
            	$("#workflow-context-menu").hide();
            	currentScale = parseFloat(scale);
            	instance.setZoom(currentScale);
            	localStorage.setItem("workflow"+net.id+"-zoom", currentScale);
            	$('#'+workflowData).css({
            		'-ms-transform': 'scale('+currentScale+','+currentScale+')', /* IE 9 */
            		'-webkit-transform': 'scale('+currentScale+','+currentScale+')', /* Chrome, Safari, Opera */
            		'transform': 'scale('+currentScale+','+currentScale+')'
            	});
            };
            
            /**
             * @method getSplitJoinType
             * Generate css class for state (split-[xor-or-and-none] or join-[xor-or-and-none])
             * @param {String} sj `split` or `join`
             * @param {veda.IndividualModel} state state
             * @return css class name for this type of split/join  
             */
            instance.getSplitJoinType = function(sj, state) {
            	if (!state.hasValue('v-wf:'+sj)) {
            		return ' '+sj+'-no';
            	}
            	var type = state['v-wf:'+sj][0].id;
            	if (type === null || type === undefined || type === '') {
            		return ' '+sj+'-no';
            	}
            	
            	if (type == 'v-wf:XOR')  return ' '+sj+'-xor';
            	if (type == 'v-wf:OR')   return ' '+sj+'-or';
            	if (type == 'v-wf:AND')  return ' '+sj+'-and';
            	if (type == 'v-wf:NONE') return ' '+sj+'-none';
            	
            	return ' '+sj+'-no';
            };
            
            /**
             * @method
             * Apply state to canvas
             */
            instance.createState = function(state) {
            	if (!state.hasValue('rdf:type')) return;
            	var type = state['rdf:type'][0].id;
            	var stateElement = '';
            	switch (type) {
    			case 'v-wf:InputCondition':    				
    				stateElement = '<div class="w state-condition" ' + 
    				    'id="' + state.id + '" ' + 
    				    'style="font-size:20px;padding-top:10px;'+ 
    				    'left:' + (canvasSizePx/2+state['v-wf:locationX'][0]) + 'px;' +
    				    'top:' + (canvasSizePx/2+state['v-wf:locationY'][0]) + 'px;">' +
					    '<div><span class="glyphicon glyphicon-play" aria-hidden="true"></div>' +
					    (mode=='edit'?'<div class="ep">':'')+'</div></div>';
    				break;
    			case 'v-wf:OutputCondition':
    				stateElement = '<div class="w state-condition" ' +
    				    'id="' + state.id + '" ' +
    				    'style="font-size:20px;padding-top:10px;' +
    				    'left:' + (canvasSizePx/2+state['v-wf:locationX'][0]) + 'px;' + 
    				    'top: ' + (canvasSizePx/2+state['v-wf:locationY'][0]) + 'px;">' +
					    '<div><span class="glyphicon glyphicon-stop" aria-hidden="true"></div></div>';
    				break;
    			case 'v-wf:Condition':
    				stateElement = '<div class="w state-condition" ' +
    				    'id="' + state.id + '" ' + 
    				    'style="left:' + (canvasSizePx/2+state['v-wf:locationX'][0]) + 'px;' + 
    				    'top:' + (canvasSizePx/2+state['v-wf:locationY'][0]) + 'px;">' +
    				    '<div class="state-name"></div>' + 
    				    (mode=='edit'?'<div class="ep">':'')+'</div></div>';
    				break;
    			case 'v-wf:Task':    				
            		stateElement = '<div class="w state-task split-join ' +
					    instance.getSplitJoinType('split', state) +
					    instance.getSplitJoinType('join', state) + '" '+
					    'id="' + state.id + '" ' +
					    'style="left:' + (canvasSizePx/2+state['v-wf:locationX'][0]) + 'px; ' + 
					    'top: ' + (canvasSizePx/2+state['v-wf:locationY'][0]) + 'px;">' + 
					    '<div class="state-name">' + state['rdfs:label'][0] + '</div>' +
					    (mode=='edit'?'<div class="ep">':'')+'</div></div>';
    				break;
    			}            	
            	if (stateElement!=='') {
                	$('#'+workflowData).append(stateElement);
                	bindStateEvents($('#' + veda.Util.escape4$(state.id)));
                	updateSVGBackground($('#' + veda.Util.escape4$(state.id)));
            	}
            };
            
            instance.addExecutorProperty = function(stateId) {
            	
                executorName = prompt("Enter name of the executor");
                executorName = new String(executorName.replace(/[^a-zA-Z0-9 ]/g, ''));
                
                var individualE = new veda.IndividualModel(); // create individual (Executor) 
                individualE.defineProperty("rdf:type");
                individualE.defineProperty("rdfs:label");
                individualE.defineProperty("v-s:script");
                
           		individualE["rdf:type"] = [veda.ontology["v-wf:ExecutorDefinition"]];
                individualE['rdfs:label'] = ['Executor `'+executorName+'`'];
                
                veda.Util.forSubIndividual(net, 'v-wf:consistsOf', stateId, function (state) {
                	state['v-wf:executor'] = (state['v-wf:executor'] === undefined)?[individualE]:state['v-wf:executor'].concat([individualE]); // <- Add new Executor to State
                });
            };
            
            instance.addVarProperty = function(stateId, type) {            
                variableName = prompt("Enter name of the variable");
                variableName = new String(variableName.replace(/[^a-zA-Z0-9 ]/g, ''));
                
                var individualV = new veda.IndividualModel(); // create individual (Variable) 
                individualV.defineProperty("rdf:type");
                individualV.defineProperty("rdfs:label");
                individualV.defineProperty("v-wf:variableName");
                
           		individualV["rdf:type"] = [veda.ontology["v-wf:Variable"]];
                individualV['rdfs:label'] = ['Variable `'+variableName+'`'];
                individualV['v-wf:variableName'] = [variableName];
                
                var individualM = new veda.IndividualModel(); // create individual (Mapping)
                
                individualM.defineProperty("rdf:type");
                individualM.defineProperty("v-wf:mapToVariable");
                individualM.defineProperty("v-wf:mappingExpression");
                
           		individualM["rdf:type"] = [veda.ontology["v-wf:Mapping"]];
           		individualM["v-wf:mapToVariable"] = [individualV];
                individualM['v-wf:mappingExpression'] = ["context.getVariableValue ('"+variableName+"')"];
                
                if (type=='input') {
                	veda.Util.forSubIndividual(net, 'v-wf:consistsOf', stateId, function (state) {
                		state['v-wf:inputVariable'] = (state['v-wf:inputVariable'] === undefined)?[individualV]:state['v-wf:inputVariable'].concat([individualV]); // <- Add new Varibale to State
                		state['v-wf:startingMapping'] = (state['v-wf:startingMapping'] === undefined)?[individualM]:state['v-wf:startingMapping'].concat([individualM]); // <- Add new Mapping to State
                	});
                }
                if (type=='output') {
                	veda.Util.forSubIndividual(net, 'v-wf:consistsOf', stateId, function (state) {
                		state['v-wf:outputVariable'] = (state['v-wf:outputVariable'] === undefined)?[individualV]:state['v-wf:outputVariable'].concat([individualV]); // <- Add new Varibale to State
                		state['v-wf:completedMapping'] = (state['v-wf:completedMapping'] === undefined)?[individualM]:state['v-wf:completedMapping'].concat([individualM]); // <- Add new Mapping to State
                	});
                }
            };
            
            // Remove from state, defined by stateId, variable `varId` and its mapping `mapId`
            instance.removeVarProperty = function(stateId, varId, mapId) {
            	veda.Util.forSubIndividual(net, 'v-wf:consistsOf', stateId, function (state) {
            		state['v-wf:inputVariable'] = veda.Util.removeSubIndividual(state, 'v-wf:inputVariable', varId);
            		state['v-wf:startingMapping'] = veda.Util.removeSubIndividual(state, 'v-wf:startingMapping', mapId);
            	});
            };
            
            instance.removeExecutorProperty = function(stateId, executorId) {
            	veda.Util.forSubIndividual(net, 'v-wf:consistsOf', stateId, function (state) {
            		state['v-wf:executor'] = veda.Util.removeSubIndividual(state, 'v-wf:executor', executorId);
            	});
            };
            
            instance.deleteState = function(element) {
            	instance.detachAllConnections(element);
            	instance.remove(element);
            	net['v-wf:consistsOf'] = veda.Util.removeSubIndividual(net, 'v-wf:consistsOf', element.id);
            };
            
            instance.createFlow = function(state, flow) {
            	var connector = instance.connect({
            		id: flow.id,
                    source: state.id,
                    target: flow['v-wf:flowsInto'][0].id
                });
            };
            
            /**
             *Create workflow Net by given Object (v-wf:Net individual).
             *@method createNetView A public method
             *@param {Object} workflowData A workflow object to create State transitions
             */
            instance.createNetView = function(net) {
            	$('#workflow-net-name').text(net['rdfs:label'][0]);
            	// Create States
            	net['v-wf:consistsOf'].forEach(function(el) {
            		el['rdf:type'].forEach(function (type) {
            			instance.createState(el);
            		});
            	});
            	
            	// Create Flows
            	net['v-wf:consistsOf'].forEach(function(el) {
            		if (undefined !== el['v-wf:hasFlow']) {
            			el['v-wf:hasFlow'].forEach(function (flow) {
            				instance.createFlow(el, flow);
            			});
            		}
            	});
            };
            
            /*
             * Optimize view of net: all elements must be visible and fit screen (through change scale and position of canvas)
             * @returns 
             */
            instance.optimizeView = function() {
            	if (!net.hasValue('v-wf:consistsOf')) return;
            	var minx, maxx, miny, maxy, scale, 
                  offsetX = 0, offsetY = 0;
            	// read ranges
            	net['v-wf:consistsOf'].forEach(function(state) {
            		if (state.hasValue('v-wf:locationX')) {
            			if (maxx === undefined || state['v-wf:locationX'][0]>maxx) maxx = state['v-wf:locationX'][0]; 
            			if (minx === undefined || state['v-wf:locationX'][0]<minx) minx = state['v-wf:locationX'][0];
            		}
            		if (state.hasValue('v-wf:locationY')) {
            			if (maxy === undefined || state['v-wf:locationY'][0]>maxy) maxy = state['v-wf:locationY'][0]; 
            			if (miny === undefined || state['v-wf:locationY'][0]<miny) miny = state['v-wf:locationY'][0];
            		}
            	});
            	// TODO update this from css;
            	miny-=25;
            	minx-=25;
            	maxx+=100;
            	maxy+=100;
            	
            	// read viewport div
            	$(".workflow-canvas-wrapper").each(function() {
            		var scaleX = this.clientWidth/(maxx-minx);
            		var scaleY = this.clientHeight/(maxy-miny);
            		scale = Math.min(scaleX, scaleY);
            		if (scaleX>scaleY) {
            			offsetX = (this.clientWidth - (maxx-minx)*scale) /2;
            		} else {
            			offsetY = (this.clientHeight - (maxy-miny)*scale) /2;
//            			offsetY = (maxy-miny)*(scaleY - scaleX) /2;
            		}
            	});
            	// change scale and offset
                $('#'+workflowData).css({
           			'left': (-minx*scale+offsetX-canvasSizePx/2)+'px',
           			'top': (-miny*scale+offsetY-canvasSizePx/2)+'px',
           		});
                instance.changeScale(scale);
            };
            
            instance.addProcessVariable = function(individualProperty, listId) {
            	if (process.hasValue(individualProperty)) {
                	$iv = $(listId);
                	process[individualProperty].forEach(function(el) {
                  	   var $item = $("<li/>").appendTo($iv);
                	   $("<a/>", {
                		   "text" : (el.hasValue('v-wf:variableName')?el['v-wf:variableName'][0]:el.id), 
       	    			   "href" : '#/individual/'+el.id+'/#main'
                	   }).appendTo($item);	            	    	
                	});
            	}
            };
            
            instance.createProcessView = function(process, reload) {            	
            	// Apply WorkItems to Net
            	var s = new veda.IndividualModel();
            	s["rdf:type"]=[ veda.ontology["v-fs:Search"] ];
            	if (reload) {            		
            		s.search("'rdf:type' == 'v-wf:WorkItem' && 'v-wf:forProcess' == '"+process.id+"'", undefined, true);
            		$('.w').each(function(index) {
            			$("span", this ).text('');
            			$( this ).css('background-color', 'white').attr('work-items-count',0);
            		});
            	} else {
            		s.search("'rdf:type' == 'v-wf:WorkItem' && 'v-wf:forProcess' == '"+process.id+"'");
            	}
            	for (var el in s.results) {
            	    if (s.results.hasOwnProperty(el)) {
            	    	var wi = s.results[el];
                		if (wi.hasValue('v-wf:forNetElement')) {
                			var state = $('#'+veda.Util.escape4$(wi['v-wf:forNetElement'][0].id));
                			var wic = parseInt(state.attr('work-items-count'));
                			if (wic>0) {                				
                				state.attr('work-items-count', wic+1);
						$(".counter", state).remove();
                				$("<span/>", {
					   			   "class" : "counter",    
                             		   "text" : 'x'+(wic+1)
                             	   }).appendTo(state);
                				
                			} else {
                				state.attr('work-items-count', 1);
                			}
            				if (wi.hasValue('v-wf:isCompleted') && wi['v-wf:isCompleted'][0]==true && state.css('background-color')!='#FFB266') {
                    			state.css('background-color', '#88B288');
            				} else {
                    			state.css('background-color', '#FFB266');
            				}
                		}
            	    }
            	}
            	// Add variables to lists
            	instance.addProcessVariable('v-wf:inputVariable','#process-input-variables');
            	instance.addProcessVariable('v-wf:localVariable','#process-local-variables');
            	instance.addProcessVariable('v-wf:outputVariable','#process-output-variables');
            };

            instance.optimizeView();
            instance.createNetView(net);
            if (mode=='view') {
            	instance.createProcessView(process);
            }
                        
            if (localStorage.getItem("workflow"+net.id+"-zoom")>0 && localStorage.getItem("workflow"+net.id+"-zoom")!=1) {
            	instance.changeScale(localStorage.getItem("workflow"+net.id+"-zoom"));	
            }
            
            /* CONTEXT MENU [BEGIN] */
            var $contextMenu = $("#workflow-context-menu");
            /* CONTEXT MENU [END]*/
            
            /* NET MENU [BEGIN] */
            $('#workflow-save-button').on('click', function() {
            	// TODO REFACTOR - recursive save (based on type checking)
           	  net.save();
        	  if (net.hasValue('v-wf:consistsOf')) {
        		  net['v-wf:consistsOf'].forEach(function(el) {
            		if (el.hasValue('v-wf:inputVariable')) {
                		el['v-wf:inputVariable'].forEach(function(v) {
                			v.save();
                		});
            		}
            		if (el.hasValue('v-wf:startingMapping')) {
            			el['v-wf:startingMapping'].forEach(function(m) {
            				m.save();
            			});
            		}
            		if (el.hasValue('v-wf:executor')) {
            			el['v-wf:executor'].forEach(function(e) {
            				e.save();
            			});
            		}
            		el.save();
        		 });
        	  }
            });
            
            $('#workflow-export-ttl').on('click', function() {
           		var list = new veda.IndividualListModel(net, net['v-wf:consistsOf']);
           		veda.Util.exportTTL(list);
            });
            
            $('.delete-state').on('click', function() {
                deleteState = confirm('Deleting State(' + $('#workflow-item-id').val() + ') ...');

                if (deleteState) {            	
                	instance.deleteState(instance.getSelector('#'+veda.Util.escape4$($('#workflow-item-id').val()))[0]);
                }
            });
            
            $('.process-refresh').on('click', function() {
            	instance.createProcessView(process, true);
            });
            
            /* ZOOM [BEGIN] */
            $('.zoom-in').on('click', function() {
            	if (currentScale<1) return instance.changeScale(currentScale + 0.1);
            	if (currentScale<2) return instance.changeScale(currentScale + 0.25);
            });

            $('.zoom-out').on('click', function() {
            	if (currentScale>1) return instance.changeScale(currentScale - 0.25);
            	if (currentScale>0.2) return instance.changeScale(currentScale - 0.1);
            });
            
            $('#'+workflowData).bind('mousewheel', function(e){
            	if(e.originalEvent.wheelDelta > 0) {
            		if (currentScale<1) { return instance.changeScale(currentScale + 0.1); }
            			else if (currentScale<2) return instance.changeScale(currentScale + 0.25);
                } else {
                    if (currentScale>1) { return instance.changeScale(currentScale - 0.25) }
                    	else if (currentScale>0.2) return instance.changeScale(currentScale - 0.1);
                }
            });
            
            $('.zoom-default').on('click', function() {            	
            	instance.optimizeView();
            });            
            /* ZOOM [END] */

            /* NET MENU [END] */
            
            return instance;
        };
    });
})();

//[END] Block of net editor
