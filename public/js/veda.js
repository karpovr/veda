function escape4$(str) {
	if (str) return str.replace(/([ #;?%&,.+*~\':"!^$[\]()=>|\/@])/g,'\\$1');      
	return str;
}

$( function () {
	$("[data-toggle=popover]")
		.mouseenter( function () {
			var popover_element = $( this );
			uri = popover_element.data("uri");
			if ($("#"+escape4$(uri)).length) {
				popover_element.popover({
					content: $("#"+escape4$(uri)).text(),
					html: true,
					placement: "auto bottom",
					container: "body"
				}).popover("show");
			} else {
				$.get("/popover/" + popover_element.data("uri"), function( data ) {
					$("<div/>", {
						id: uri,
						text: data,
						class: "hide",
					}).appendTo("body");
					popover_element.popover({
						content: data,
						html: true,
						placement: "auto bottom",
						container: "body"
					}).popover("show");
				});
			}	
			popover_element.mouseleave ( function () {
				popover_element.off("mouseleave");
				popover_element.popover("destroy");
			});
		});
});