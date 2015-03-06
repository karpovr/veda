// Browser-side utility functions

veda.Module(function Util(veda) { "use strict";
	
	veda.Util = veda.Util || {};

	// Escape function for css (jQuery) selectors
	veda.Util.escape4$ = function (str) {
		if (str) return str.replace(/([ #;?%&,.+*~\':"!^$[\]()=>|\/@])/g,'\\$1');
		return str;
	}

	// Localize nodeSelector
	veda.Util.localize = function (container, lang) {
		/*$.ajax({
			type: "GET",
			dataType: "script",
			url: "js/i18n/vocabulary_"+lang.toLowerCase()+".js",
			async: false,
			cache: true,
		}).done(function( msg ) {
			eval(msg);
			$('[i18n]', container).each(function() {
				$(this).text($.i18n._($(this).attr('i18n')));
			});
		});*/
	}
	
	function isInteger (n) { return n % 1 === 0; }
	
	veda.Util.exportTTL = function (individualList) {
		var s = new veda.SearchModel("'rdf:type'=='owl:Ontology'", null);
		var prefixes = {};
		prefixes["dc"] = "http://purl.org/dc/elements/1.1/";
		prefixes["grddl"] = "http://www.w3.org/2003/g/data-view#";
		Object.getOwnPropertyNames(s.results).map( function (res_id) {
			var res = s.results[res_id];
			prefixes[res_id.substring(0,res_id.length-1)] = res["v-s:fullUrl"][0].toString();
		});
		var writer = N3.Writer({ prefixes: prefixes });
		individualList.each(function (individual) {
			var triple = {};
			if (individual.id.indexOf(":") == individual.id.length-1) {
				triple.subject = prefixes[individual.id.substring(0, individual.id.length - 1)];
			} else {
				triple.subject = N3.Util.expandPrefixedName(individual.id, prefixes);
			}
			Object.getOwnPropertyNames(individual.properties).map(function (property_uri) {
				triple.predicate = N3.Util.expandPrefixedName(property_uri, prefixes);
				individual[property_uri].map(function (value) {
					if (value instanceof Number || typeof value === "number" ) {
						triple.object = isInteger(value.valueOf()) ? '"' + value.valueOf() + '"^^' + N3.Util.expandPrefixedName('xsd:integer', prefixes) : '"' + value.valueOf() + '"^^' + N3.Util.expandPrefixedName('xsd:decimal', prefixes);
					} else if (value instanceof Boolean || typeof value === "boolean") {
						triple.object = '"' + value.valueOf() + '"^^' + N3.Util.expandPrefixedName("xsd:boolean", prefixes);
					} else if (value instanceof String || typeof value === "string") {
						triple.object = value.language ? '"' + value.valueOf() + '"@' + value.language.toLowerCase() : '"' + value.valueOf() + '"^^' + N3.Util.expandPrefixedName("xsd:string", prefixes);
					} else if (value instanceof Date) {
						triple.object = '"' + value.toISOString() + '"^^' + N3.Util.expandPrefixedName("xsd:dateTime", prefixes);
					} else if (value instanceof veda.IndividualModel) {
						if (value.id.indexOf(":") == value.id.length-1) {
							triple.object = prefixes[value.id.substring(0, value.id.length - 1)];
						} else {
							triple.object = N3.Util.expandPrefixedName(value.id, prefixes);
						}
					}
					writer.addTriple(triple);
				});
			});
		});
		writer.end(function (error, result) { 
			var blob = new Blob([result], {type: "text/plain;charset=utf-8"});
			saveAs(blob, "exported_graph.ttl");
		});
	}
	
});
