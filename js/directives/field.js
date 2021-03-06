/**
 * <field> directive
 * 
 * Renders individual <field> elements into container, label, and input and 
 * populates ng-model attributes.
 */
angular.module( 'griot' ).directive( 'field', function() {

	return {

		restrict: 'E',
		replace: true,
		scope: {
			data:'=',
			ui:'='
		},
		controller: function( $scope, $element, $attrs, ModelChain ) {

			$scope.griotData = griotData;

			$scope.protected = $attrs.hasOwnProperty( 'protected' );

			$scope.toggleProtection = function() {
				$scope.protected = ! $scope.protected;
			};

			/**
			 * Update ModelChain, unless the template of this type of field includes
			 * the 'bypassModel' attribute. 
			 * 
			 * bypassModel simply copies the model and modelChain from the parent 
			 * scope and makes them available to child directives, without adding the
			 * current field's name. This is useful when the field contains a 
			 * collection of other fields. E.g. if the field's name in the markup is
			 * 'customfield' and it's an alias for inputs with names 'A', 'B' and 'C', 
			 * updateModel will try (and likely fail) to create this structure:
			 *
			 * data {
			 *   customfield: { // Initialize this as an object or else it will fail!
	     *     A: 'value',
	     *     B: 'value',
	     *     C: 'value'
	     *   }
	     * }
	     *
	     * Applying bypassModel to the main field cuts out the middle man:
	     *
			 * data {
			 *   A: 'value',
			 *   B: 'value',
			 *   C: 'value'
			 * }
			 * 
			 */
			if( $attrs.hasOwnProperty( 'bypassmodel' ) ) {

				ModelChain.bypassModel( $scope );

			} else {

				ModelChain.updateModel( $scope, $attrs.name );

			}

		},
		template: function( elem, attrs ) {

			var fieldhtml;

			switch( attrs.type ){

				case 'objectselector':
					fieldhtml = "<objectselector name='" + attrs.name + "' />";
					break;

				case 'text':
					fieldhtml = "<input type='text' ng-model='model." + attrs.name + "' ng-disabled='protected' />";
					break;

				case 'textarea':
					fieldhtml = "<textarea ng-model='model." + attrs.name + "' ng-disabled='protected' ></textarea>";
					break;

				case 'wysiwyg':
					fieldhtml = "<textarea ng-model='model." + attrs.name + "' ck-editor ng-disabled='protected' ></textarea>";
					break;

				case 'zoomer':

					attrs.bypassmodel = 'bypassmodel';

					var transcrude = elem.html();

					fieldhtml = "<zoomer name='" + attrs.name + "' object='" + attrs.object + "' annotations-name='" + attrs.annotationsName + "' annotations-label='" + attrs.annotationsLabel + "' annotations-label-singular='" + attrs.annotationsLabelSingular + "' annotations-label-plural='" + attrs.annotationsLabelPlural + "'>" + transcrude + "</zoomer>";

					break;

				case 'relationship':
					fieldhtml = "<select ng-model='model." + attrs.name + "' ng-options='( record.ID | parseInt ) as ( record | getTitle ) for record in ui.recordList[ ui.oppositeRecordType ]' multiple ng-disabled='protected' ></select>";
					break;

				case 'image':
					fieldhtml = "<imagepicker name='" + attrs.name + "' />";
					break;

				case 'select':
					/**
					 * Angular really, really doesn't like non-dynamic selects, but we
					 * still want the model management, so we have to convert our static
					 * select into a dynamic one. Here (in the template) we grab the
					 * object elements, convert them to JSON, and store them in an
					 * element attribute. When linking, we'll read the JSON from the
					 * attributes and construct an array in scope to read options from.
					 */
					var tempFieldOptions = [];
					$options = jQuery( elem ).find( 'option' );
					$options.each( function( i, option ) {
						tempFieldOptions.push({
							value: jQuery( option ).val(),
							label: jQuery( option ).text(),
							selected: jQuery( option ).prop( 'selected' )
						});
					});
					attrs.jsonFieldOptions = angular.toJson( tempFieldOptions );
					fieldhtml = "<select ng-model='model." + attrs.name + "' ng-options='option.value as option.label for option in fieldOptions'></select>";
					break;

				case 'checkbox':
					fieldhtml = "<input type='checkbox' ng-model='model." + attrs.name + "' />";
					break;

			}

			var templatehtml = "<div class='griot-field-wrap' ng-class='{ \"griot-protected\": protected }' data='data' ui='ui' ng-hide='attrs.hidden'>" +
				"<div class='griot-field-meta'>";

			// Add label if specified
			if( attrs.hasOwnProperty( 'label' ) ) {

				templatehtml += "<span class='griot-label'>" + attrs.label + "</span>";

			}

			// Add lock/unlock control if specified
			if( attrs.hasOwnProperty( 'protected' ) ) {

				templatehtml += "<a class='griot-button' ng-if='protected' ng-click='toggleProtection()'>Unlock</a>" +
					"<a class='griot-button' ng-if='!protected' ng-click='toggleProtection()'>Lock</a>";
			}

			templatehtml += "</div>" +
				"<div class='griot-field'>" +
					fieldhtml +
				"</div>" +
			"</div>";

			return templatehtml;

		},
		link: function( scope, elem, attrs ) {

			if( 'undefined' !== typeof( attrs.autofill ) ) {

				try{
					scope.model[ attrs.name ] = scope.$eval( attrs.autofill );
				} catch( e ) {
					console.log( 'Autofill error on ' + attrs.name + ':' + e );
				}

			}

			switch( attrs.type ) {

				case 'select':

					// See select field in template function above
					scope.fieldOptions = angular.fromJson( attrs.jsonFieldOptions );

					// Set default
					if( ! scope.model[ attrs.name ] ) {
						angular.forEach( scope.fieldOptions, function( option ) {
							if( option.selected ){
								scope.model[ attrs.name ] = option.value;
							}
						});
					}

					break;
			}
		}

	};

});