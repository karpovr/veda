// Document Model

"use strict";

Veda.prototype.DocumentModel = function DocumentModel(uri) {
	var self = riot.observable(this);

	// Define Model data setters & getters
	var individual = {};
	Object.defineProperty(self, "individual", {
		get: function() { return individual; },
		set: function(value) { if (compare(individual, value)) return; individual = value; self.trigger("set", "individual", value); }
    });
	if (typeof console != "undefined") self.on("set", function(property, value){ console.log("property set:", property, "=", value) });
		
	// Define Model functions
	self.load = function(uri) {
		get_individual(veda.ticket, uri, function(data) {
			self.individual = data;
			self.trigger("loaded");
		});
	};
	self.save = function() {
		put_individual(veda.ticket, self.individual, function(data) {
			self.trigger("saved");
		});
	};

	// Define Model event handlers
	self.on("loaded", function() { 
		console.log("document loaded: ", self.individual);
	});
	self.on("saved", function() { 
		console.log("document saved: ", self.individual);
	});

	// Load data 
	if (uri) self.load(uri);

	return self;
};
