/**
 * Main application module
 */
angular.module( 'griot', [] );

	
jQuery( document ).ready( function() { 


	// Prepare WP environment
	jQuery( '#poststuff' )

		// Define Angular app and controller
		.attr({
			'ng-app':'griot',
			'ng-controller':'griotCtrl'
		})

		// Create main application container and hidden content field
		.find( '#post-body-content' ).append( "<div id='griot'>" +
					"<div media-drawer></div>" +
					"<textarea name='content' id='griot-data'>{{ data | json }}</textarea>" +
					"<fieldset>" +
						"<field type='text' name='objectid' label='Object ID' />" +
					"</fieldset>" +
				"</div>" 
		)

		// Link title field to model
		.find( '#title' ).attr({
			'ng-model':'data.title'
		});


	/**
	 * Manually initialize Angular after environment is set up
	 */
	angular.bootstrap( document, ['griot'] );

});
jQuery( document ).ready( function() {

	/** 
	 * Tile server field
	 */
	jQuery( "input[name='griot_tile_server']" ).on( 'change', function( e ) {

		if( ! e.target.value ) {
			jQuery( '#griot-tile-server-response' ).fadeOut( 200, function(){
				jQuery( this ).removeClass( 'error success' ).html( '' );
			});
			return;
		}

		jQuery( '#griot-tile-server-response' ).removeClass( 'success error' ).html( 'Fetching config ...' ).fadeIn( 200 );

		var request = {
			action: 'griot_get_config',
			config_url: e.target.value
		};

		jQuery.post( ajaxurl, request, function( data ) {

			if( 'error' === data ) {
				jQuery( '#griot-tile-server-response' ).removeClass( 'success' ).addClass( 'error' ).html( '<strong>Error:</strong> The tile server config cannot be read. It may be missing, inaccessible, or malformed.' ).fadeIn( 200 );
				return;
			}

			var config = JSON.parse( data ),
			  objectCount = 0,
			  imageCount = 0;

			console.log( config );

			for( var prop in config.objects ) {
				if( !isNaN ( parseFloat( prop ) ) && isFinite( prop ) ) {
					objectCount++;
				}
			}

			imageCount = config.all.length;

			jQuery( '#griot-tile-server-response' ).removeClass( 'error' ).addClass( 'success' ).html( '<strong>Success!</strong> Found <strong>' + objectCount + '</strong> objects and <strong>' + imageCount + '</strong> zoomable images.' ).fadeIn( 200 );

		});

	});


	/**
	 * Static image source fields
	 */
	if( jQuery( '#griot-image-source-setting-external' ).is( ':checked' ) ) {

		jQuery( '#griot-image-list-setting' ).closest( 'tr' ).show();

	} else {

		jQuery( '#griot-image-list-setting' ).closest( 'tr' ).hide();

	}
	jQuery( "input[name='griot_image_source']" ).on( 'change', function() {

		if( jQuery( '#griot-image-source-setting-external' ).is( ':checked' ) ) {

			jQuery( '#griot-image-list-setting' ).closest( 'tr' ).fadeIn( 100 );

		} else {

			jQuery( '#griot-image-list-setting' ).closest( 'tr' ).fadeOut( 100 );

		}

	});
	
});
/**
 * Application controller
 *
 * Initializes data object and scope chain
 */
angular.module( 'griot' ).controller( 'griotCtrl', function( $scope, $http, ModelChain ) { 

	// Initialize model chain
	ModelChain.initialize( $scope );

	// Initialize data object and load previously saved data into model. 
	// See Griot::print_data() in class-griot.php
	$scope.data = griotData.data ? JSON.parse( griotData.data ) : {};
	$scope.data.title = griotData.title;
	$scope.ui = {
		recordType: griotData.recordType,
		oppositeRecordType: griotData.recordType == 'object' ? 'story' : 'object',
		recordList: griotData.recordList,
		tileServer: griotData.tileServer,
		zoomables: griotData.config,
		objects: []
	};

	if( griotData.config ) {

		for( var objectid in griotData.config.objects ) {

			if( 'null' === objectid || '_empty_' === objectid ) {
				continue;
			}

			$scope.ui.objects.push( objectid );

		}

	}
	else {
		console.log( 'WARNING: No config detected!' );
	}

});
/**
 * filterObjects filter
 *
 * Return array of zoomables from specified object, or if not specified, from
 * ui.zoomables master array
 */
angular.module( 'griot' ).filter( 'filterObjects', function() {

  return function( objects, ui, requestedID ) {

  	if( ui.zoomables ) {

	  	if( requestedID ) {
	  		return ui.zoomables.objects[ requestedID ];
	  	} else {
	  		return ui.zoomables.all;
	  	}

	  }
	  else {
	  	console.log( 'WARNING: No config detected!' );
	  }

  };

});
/**
 * filterMediaByObject filter
 *
 * Filters media by current object ID, if applicable and enabled.
 */
angular.module( 'griot' ).filter( 'filterMediaByObject', function( ModelChain ) {

  return function( media, enabled, objid ) {

		var filtered = [];

  	if( ! enabled ){
  		return media;
  	}

    angular.forEach( media, function(image) {
      if( image.object_id == objid ) {
        filtered.push( image );
      }
    });

    return filtered;

  };
});
/**
 * getTitle filter
 *
 * For use in defining relationships between records. Returns the title if one
 * is set, otherwise 'Untitled (post #{ID})'
 */
angular.module( 'griot' ).filter( 'getTitle', function() {

  return function( record ) {

    return record.post_title === '' ? 'Untitled (post #' + record.ID + ')' : record.post_title;

  };

});
/**
 * parseInt filter
 *
 * Parses string as integer
 */
angular.module( 'griot' ).filter( 'parseInt', function() {
 	return function( record ) {
 		return parseInt( record );
 	};
});
/**
 * annotations="" directive
 *
 * Adds listeners and callbacks to repeaters that represent image annotations.
 */
angular.module( 'griot' ).directive( 'annotations', function( $timeout, $compile ) {

	return {

		restrict: 'A',
		require: ['repeater','^zoomer'],
		link: function( scope, elem, attrs, ctrls ) {

			var _this = this;

			// Define controllers
			var repeaterCtrl = ctrls[0];
			var zoomerCtrl = ctrls[1];

			// Get zoomerCtrl scope
			var imageScope = zoomerCtrl.getScope();

			// Delete Add Annotation button and replace with Zoom Out button
			var zoomButton = angular.element( "<a class='griot-button' ng-show='hasMap()' ng-click='zoomOut()'>Zoom Out</a>" );
			var compiled = $compile( zoomButton );
			elem.find( '.griot-button' ).first().replaceWith( zoomButton );
			compiled( imageScope );

			/**
			 * Change focused image area when user advances repeater slider
			 */
			scope.$watch( 
				function() {
					return repeaterCtrl.getActiveIndex();
				},
				function() {
					var zoomer = zoomerCtrl.getZoomer();
					var annotations = zoomerCtrl.getAnnotations();
					if( ! annotations[ repeaterCtrl.getActiveIndex() ] ) {
						return;
					}
					var geoJSON = annotations[ repeaterCtrl.getActiveIndex() ].geoJSON;
					var layer = L.GeoJSON.geometryToLayer( geoJSON.geometry );
					if( zoomer ) {
						zoomer.map.fitBounds( layer );
					}
				}
			);

			/**
			 * Attach listeners to zoomer on creation
			 */
			scope.$watch(
				function() {
					return zoomerCtrl.getZoomer();
				},
				function( zoomer ) {
					if( zoomer ) {

						angular.forEach( zoomerCtrl.getImageLayers()._layers, function( layer ) {

							layer.on( 'click', function( e ){

								if( ! _this.deleting ) {
								
									var clickedAnnotation = e.target.annotation;

									var index = jQuery.inArray( clickedAnnotation, zoomerCtrl.getAnnotations() );

									repeaterCtrl.swipeTo( index );

								}

							});

						});

						zoomer.map.on( 'draw:deletestart', function() {

							_this.deleting = true;

						});

						zoomer.map.on( 'draw:deletestop', function() {

							_this.deleting = false;

						});


						/**
						 * Sync annotations created via zoomer
						 */
						zoomer.map.on( 'draw:created', function( e ) {

							// Create geoJSON from draw event
							var geoJSON = e.layer.toGeoJSON();

							scope.$apply( function() {

			    			// Add geoJSON to annotation record in data object
				    		var length = zoomerCtrl.getAnnotations().push({
					    		geoJSON: geoJSON
					    	});

				    		// Get a reference to the new annotation
					    	var annotation = zoomerCtrl.getAnnotations()[ length - 1 ];

					    	// Convert geoJSON to layer
					    	var layer = L.GeoJSON.geometryToLayer( geoJSON.geometry );

					    	// Store reference in layer
								layer.annotation = annotation;

								// Add to local image layers collection
								zoomerCtrl.getImageLayers().addLayer( layer );

								// Zoom in on image
								zoomer.map.fitBounds( layer );

								// Attach click handler
								layer.on( 'click', function( e ){

									if( ! _this.deleting ) {
									
										var clickedAnnotation = e.target.annotation;

										var index = jQuery.inArray( clickedAnnotation, zoomerCtrl.getAnnotations() );

										repeaterCtrl.swipeTo( index );

									}

								});

							});

						});


						/**
						 * Sync annotations deleted via zoomer
						 */
						zoomer.map.on( 'draw:deleted', function( e ) {

							var repeater = repeaterCtrl.getRepeater();

							var activeIndex = repeaterCtrl.getActiveIndex();
							var newActiveIndex = 0;

							var goodEggs = [];
							var badEggs = [];

							angular.forEach( e.layers._layers, function( layer ) {

								var index = jQuery.inArray( layer.annotation, zoomerCtrl.getAnnotations() );

								badEggs.push( index );

							});

							angular.forEach( zoomerCtrl.getAnnotations(), function( annotation, index ) {

								if( -1 === jQuery.inArray( index, badEggs ) ) {

									goodEggs.push( index );

								}

							});

							badEggs.reverse();

							for( var i = 0; i === badEggs.length; i++ ) {


								if( activeIndex === 0 ) {

									break;

								}

								if( activeIndex === badEggs[i] ) {

									activeIndex--;

								}

							}

							angular.forEach( goodEggs, function( goodEgg, index ) {

								if( activeIndex === goodEgg ) {

									newActiveIndex = index;

								}

							});

							angular.forEach( badEggs, function( badEgg ) {

								scope.$apply( function() {

										zoomerCtrl.getAnnotations().splice( badEgg, 1 );
									
								});

							});

							repeater.swipeTo( newActiveIndex, 0, false );

						});


						/**
						 * Sync annotations edited via zoomer
						 */
						zoomer.map.on( 'draw:edited', function( e ) {

							angular.forEach( e.layers._layers, function( layer ) {

								var geoJSON = layer.toGeoJSON();

								scope.$apply( function() {

									layer.annotation.geoJSON = geoJSON;

								});
								
							});

						});

					}
				}
			);
		}
	};
});
/**
 * ckeditor="" directive
 * 
 * Renders CKEditor on WYSIWYG fields and keeps model updated (CKEditor 
 * doesn't update textarea natively)
 *
 * See: http://stackoverflow.com/questions/11997246/bind-ckeditor-value-to-model-text-in-angularjs-and-rails
 */
angular.module( 'griot' ).directive( 'ckEditor', function() {

  return {

  	restrict: 'A',
    require: ['?^repeater', '?ngModel'],
    link: function( scope, elem, attrs, ctrls ) {

    	// Define controllers
    	var repeater = ctrls[0];
    	var ngModel = ctrls[1];

    	// Apply CKEditor
      var ck = CKEDITOR.replace( elem[0], {
        toolbar: [ 
          [ 'Bold', 'Italic', 'Subscript', 'Superscript', '-', 'NumberedList', 'BulletedList', 'Outdent', 'Indent', '-', 'HorizontalRule', 'SpecialChar', '-', 'PasteFromWord', '-', 'Undo', 'Redo', '-', 'Source' ] 
        ],
        allowedContent: {
          img: {
            attributes: [ '!src', 'alt', 'width', 'height' ],
            styles: '*'
          }
        }
      });

      if( repeater ) {

      	// If within a repeater, reset size once wysiwyg is rendered
      	ck.on( 'instanceReady', function() {

      		repeater.refresh();

      	});

      }

      /*
      if( !ngModel ) {
      	return;
      }
      */

      // Load CKEditor value into ng-model/textarea 
      ck.on( 'pasteState', function() {

        scope.$apply( function() {

          ngModel.$setViewValue( ck.getData() );

        });

      });

      // Load ng-model/textarea value into CKEditor
      ngModel.$render = function( value ) {

        ck.setData( ngModel.$viewValue );

      };

      // Update readonly (i.e. disabled) value when protected status changes
      if( attrs.hasOwnProperty( 'protected' ) ) {

	      ck.on( 'instanceReady', function() {

		      scope.$watch( 'protected', function( value ) {

		      	ck.setReadOnly( value );
		      	
		      });

	      });

	    }

  	}
	
	};

});
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

			$scope.protected = false;

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
					fieldhtml = "<select ng-model='model." + attrs.name + "' ng-options='object for object in ui.objects' ng-disabled='protected'><option value=''>None</option></select>";
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

				case 'zoomerselector':
					fieldhtml = "<select ng-model='model." + attrs.name + "' ng-options='object for object in ( ui.objects | filterObjects : ui : data." + attrs.object + " )' ng-disabled='protected'><option value=''>None</option></select>";
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
/**
 * <fieldset> directive
 * 
 * Renders fields from template
 */
angular.module( 'griot' ).directive( 'fieldset', function() {

	return{

		restrict: 'E',
		replace: true,
		templateUrl: function() {
			return griotData.templateUrl;
		}

	};

});
/**
 * .griot-repeater-fields directive
 *
 * Reinitializes Swiper instance of parent repeater when the last repeater
 * item is printed and when height changes, and controls tabbing behavior
 * between fields in separate repeater items
 */
angular.module( 'griot' ).directive( 'griotRepeaterFields', function( $timeout ) {

	return {

		restrict:'C',
		require:'^repeater',
		link: function( scope, elem, attrs, repeaterCtrl ) {

			var _this = this;

			// Reinitialize Swiper instance when last repeater item is printed
			if( scope.$last ) {

				repeaterCtrl.refresh();

				// ... and turn "initializing" off
				$timeout( function() {
					repeaterCtrl.stopInitializing();
				});

			}

			// Reinitialize Swiper instance when height changes
			scope.$watch( 

				function( ) { 
					return elem.height();
				}, 
				function( newValue, oldValue ) {
					if( newValue != oldValue ) {
						repeaterCtrl.refresh();
					}
				}

			);

			// Intercept tabbing and move destination into view before focusing on 
			// the next field. This prevents repeater items from getting "stuck"
			// halfway in view and helps create a logical tabbing workflow.
			elem.find( 'input,textarea' ).last().on( 'keydown', function( e ) {

				// Tabbing forward from last input of a repeater item
				if( e.keyCode === 9 && e.shiftKey === false && !repeater.nextDisabled() ) {
					repeater.nextFocus();
					return false;
				}

				// Tabbing backward from first input of a repeater item
				if( e.keyCode === 9 && e.shiftKey === true && !repeater.prevDisabled() ) {
					repeater.prevFocus();
					return false;
				}

			});

		}

	};

});
/**
 * <imagepicker> directive
 *
 * Sets up a (non-isolate) scope and controller and prints fields needed to
 * add and annotate zoomable images.
 */
angular.module( 'griot' ).directive( 'imagepicker', function( $compile ) {

	return{

		restrict: 'E',
		replace: true,
		template: function( elem, attrs ) {

			var templateHtml = "<div class='griot-imagepicker' >";
			
			if( 'external' === griotData.imageSrc ) {

				templateHtml += "<div class='griot-image-chooser' ng-class='{active: angframe.isOpen}'>" +
					"<img class='griot-image-thumbnail' ng-repeat='imageUrl in imageList' ng-src='{{ imageUrl }}' ng-click='angframe.select( imageUrl )' />" +
				"</div>";

			}

			templateHtml += "<div class='griot-current-image' ng-class='{empty: !hasImage }' ng-style='{ backgroundImage: backgroundImage }' ng-click='openFrame()'></div>" +
				"</div>";

			return templateHtml;

		},
		controller: function( $scope, $element, $attrs ) {

    	$scope.hasImage = $scope.model[ $attrs.name ];

			$scope.backgroundImage = $scope.model[ $attrs.name ] ? 'url(' + $scope.model[ $attrs.name ] + ')' : 'auto';

			$scope.isImageTarget = false;

			// If using WordPress image library ...

			$scope.wpmframe = wp.media.griotImageLibrary.frame();

			$scope.wpmframe.on( 'select', function() {

				if( $scope.isImageTarget ) {

					var selection = $scope.wpmframe.state().get( 'selection' );
					selection.each( function( attachment ) {

						if( attachment.attributes.url ) {

							$scope.$apply( function() {
								$scope.model[ $attrs.name ] = attachment.attributes.url;
								$scope.backgroundImage = 'url(' + attachment.attributes.url + ')';
								$scope.isImageTarget = false;
								$scope.hasImage = true;

							});

						}

					});
					
	    	}

    	});

    	// If using Angular image library ... 

    	$scope.imageList = griotData.imageList;

    	$scope.angframe = {

    		isOpen: false,

    		select: function( url ) {

    			if( url ) {

						$scope.model[ $attrs.name ] = url;

						$scope.backgroundImage = 'url(' + url + ')';

						$scope.isImageTarget = false;

						$scope.hasImage = true;

	    		}

	    		$scope.angframe.close();

    		},

    		open: function() {
  				$scope.angframe.isOpen = true;
    		},

    		close: function() {
    			$scope.angframe.isOpen = false;
    		},

    		toggle: function() {
    			$scope.angframe.isOpen = ! $scope.angframe.isOpen;
    		}

    	};

			$scope.openFrame = function() {

				if( $scope.protected ) {
					return;
				}

				if( 'wordpress' === griotData.imageSrc ) {

					$scope.wpmframe.open();

				} else {

					$scope.angframe.toggle();

				}

				$scope.isImageTarget = true;

			};

			$scope.removeImage = function() {

				if( $scope.protected ) {
					return;
				}

				$scope.model[ $attrs.name ] = null;
				$scope.hasImage = false;
				$scope.backgroundImage = 'auto';
				$scope.angframe.close();

			};

		},
		link: function( scope, elem, attrs ) {

			var addImageBtn = angular.element( "<a class='griot-button griot-pick-image' ng-disabled='protected' ng-click='openFrame()' ng-if='!hasImage'>Choose image</a>" +
				"<a class='griot-button griot-pick-image' ng-disabled='protected' ng-click='openFrame()' ng-if='hasImage'>Change image</a>" +
				"<a class='griot-button griot-remove-image' ng-disabled='protected' ng-if='hasImage' ng-click='removeImage()'>Remove image</a>" );
			var compiled = $compile( addImageBtn );
			elem.closest( '.griot-field-wrap' ).find( '.griot-field-meta' ).append( addImageBtn );
			compiled( scope );

		}

	};

});

wp.media.griotImageLibrary = {
     
	frame: function() {
	
		if( this._frame ) {
			return this._frame;
		}

		this._frame = wp.media({
			id:         'griot-library-frame',                
			title:      'Insert an image',
			multiple:   false,
			editing:    true,
			library:    { type: 'image' },
			button:     { text: 'Insert' }
		});

		return this._frame;

	},

};

/**
 * mediaDrawer="" directive
 *
 * Controls drawer for searching and filtering media for zoomers.
 */
angular.module( 'griot' ).directive( 'mediaDrawer', function( $http ) {

	return {

		restrict: 'A',
		replace: true,
		template: "<div class='griot-media-drawer' ng-class=\"{'visible':drawerVisible}\" ng-click=''>" +
			"<h2>Available Media</h2>" +
			"<input class='griot-media-search' type='text' ng-model='mediaSearch.meta' id='griot-media-search' placeholder='Search media' />" +
			"<input class='griot-media-filter-by-object' type='checkbox' ng-model='filterByObject' id='griot-media-filter-by-object' />" +
			"<label class='griot-media-label' for='griot-media-filter-by-object'>Current object media only</label>" +
			"<div class='griot-media'>" +
				"<div class='griot-media-thumb' ng-repeat='image in media | filterMediaByObject:filterByObject:data.id | filter:mediaSearch | limitTo:20'>" +
					"<img ng-src='{{image.thumb}}' />" +
				"</div>" +
			"</div>" +
		"</div>",
		controller: function( $scope, $element, $attrs ){

			var devZoomables;

			$scope.drawerVisible = true;
			$scope.media = [];

			/**
			 * Get the dev zoomables (soon to be the config) and arrange into a structure
			 * that we can use in the media drawer.
			 */
			$http.get( 'http://author.loc/wp-content/plugins/GriotWP/tdx_rev.json' )
				.success( function(data){
					devZoomables = data;
				})
				.then( function(){
					for( var objid in devZoomables ){
						var images = devZoomables[ objid ].images;
						var meta = devZoomables[ objid ].meta;
						for( var i = 0; i < images.length; i++ ){
							var image = images[i];
							var filename = image.file.split('.tif');
							image.object_id = objid;
							image.thumb = 'http://tiles.dx.artsmia.org/v2/' + image.file.split('.tif')[0] + '/0/0/0.png';
							image.meta = [ meta.artist, meta.continent, meta.country, meta.creditline, meta.culture, meta.description, meta.medium, meta.title ].join(' ');
							$scope.media.push( image );
						}
					}
				});
		},
		link: function( scope, elem, attrs ) {
		}
	};

});
/**
 * <repeater> directive
 *
 * Renders repeaters and provides an API for manipulating each repeater's
 * underlying Swiper object (which is stored in the local scope). Most of
 * these methods are internal, but some may be called from other directives.
 */
angular.module( 'griot' ).directive( 'repeater', function( $timeout ) {

	return {

		restrict: 'E',
		replace: true,
		scope: {
			data:'=',
			ui:'='
		},
		transclude: true,
		controller: function( $scope, $element, $attrs, $timeout, ModelChain ) {

			// Update model chain properties
			ModelChain.updateModel( $scope, $attrs.name );

			// Visibility of repeater item menu
			$scope.showMenu = false;

			// Status of repeater nav options
			$scope.prevDisabled = true;
			$scope.nextDisabled = true;

			$scope.initializing = true;


			/**
			 * Register an empty repeater array in main data object
			 */ 
			$scope.register = function( repeaterName ) {

				if( ! $scope.model.hasOwnProperty( repeaterName ) ) {

					$scope.model[ repeaterName ] = [];

				}

			};


			/**
			 * Create Swiper instance and add to local scope
			 */
			$scope.build = function( repeaterElement ) {

				var repeater = repeaterElement.find( '.swiper-container' ).first().swiper({
					calculateHeight: true,
					pagination: repeaterElement.find( '.griot-repeater-pagination' ).first()[0],
					paginationClickable: true,
					paginationElementClass: 'griot-repeater-bullet',
					paginationActiveClass: 'active',
					onSlideChangeStart: function(){
    				$scope.refreshNav();
    				//$scope.$broadcast( 'slideChange' );
  				},
  				onSlideChangeEnd: function(){
  					$scope.$broadcast( 'slideChange' );
  				},
  				onInit: function(){
  					$scope.$broadcast( 'slidesReady' );
  				},
  				noSwiping: true,
  				noSwipingClass: 'griot-prevent-swipe'
				});

				$scope.repeater = repeater;

			};


			/**
			 * Keep repeater nav in sync with repeater position
			 */
			$scope.refreshNav = function() {
				
				// Test ability to regress
				if( $scope.repeater.activeIndex === 0 ) {

					$timeout( function() {
						$scope.prevDisabled = true;
					});

				} else {

					$timeout( function() {
						$scope.prevDisabled = false;
					});

				}

				// Test ability to advance
				if( $scope.repeater.activeIndex === $scope.repeater.slides.length - 1 ) {

					$timeout( function() {
						$scope.nextDisabled = true;
					});

				} else {

					$timeout( function() {
						$scope.nextDisabled = false;
					});

				}

			};


			/** 
			 * Reinitialize (and redraw) Swiper instance
			 */
			$scope.refresh = function() {

				$timeout( function() {

					var oldLength = $scope.repeater.slides.length;

					$scope.repeater.reInit();

					var newLength = $scope.repeater.slides.length;

					if( newLength > oldLength && ! $scope.initializing ) {

						$scope.repeater.swipeTo( newLength - 1 );

					} else {

						$scope.repeater.swipeTo( $scope.repeater.activeIndex );

					}

					$scope.refreshNav();

				});

			};


			/**
			 * Add an item to a repeater
			 */
			$scope.add = function( repeaterModel ) {

				$scope.showMenu = false;

				repeaterModel.push( {} );

			};


			/**
			 * Remove an item from a repeater
			 */
			$scope.remove = function( repeaterModel, itemIndex ) {

				$scope.showMenu = false;

				repeaterModel.splice( itemIndex, 1 );

			};


			/**
			 * Rearrange repeater items
			 */
			$scope.rearrange = function( repeaterModel, currentItemIndex, newItemIndex ) {

				repeaterModel.splice( newItemIndex, 0, repeaterModel.splice( currentItemIndex, 1)[0] );

				$timeout( function(){ 
					$scope.repeater.swipeTo( newItemIndex );
				});

			};


			/**
			 * Toggle the repeater menu
			 */
			$scope.toggleMenu = function() {

				$scope.showMenu = !$scope.showMenu;

			};


			/**
			 * Slide to active index
			 */
			$scope.swipeToActive = function() {

				$timeout( function() {

					$scope.repeater.swipeTo( $scope.repeater.activeIndex );

				});

			};


			/**
			 * Reinitialize (and redraw) Swiper instance (external reference)
			 */
			this.refresh = function() {

				$scope.refresh();

			};


			this.add = function( repeaterModel ) {

				$scope.add( repeaterModel );

			};


			/** 
			 * Advance repeater and set focus on first input element (external)
			 */
			this.nextFocus = function() {

				if( ! $scope.nextDisabled ) {

					$scope.repeater.swipeNext();

					/* Wait for animation to finish before setting focus */
					setTimeout( function() {
						jQuery( $scope.repeater.slides[ $scope.repeater.activeIndex ] ).find( 'input,textarea' ).first().focus();
					}, $scope.repeater.params.speed + 10 );

				}

			};


			/** 
			 * Regress repeater and set focus on last input element (external)
			 */
			this.prevFocus = function() { 

				if( ! $scope.prevDisabled ) {

					$scope.repeater.swipePrev();

					/* Wait for animation to finish before setting focus */
					setTimeout( function() {
						jQuery( $scope.repeater.slides[ $scope.repeater.activeIndex ] ).find( 'input,textarea' ).last().focus();
					}, $scope.repeater.params.speed + 10 );

				}

			};


			/** 
			 * Expose nav status (external)
			 */
			this.nextDisabled = function() {

				return $scope.nextDisabled;

			};
			this.prevDisabled = function() {

				return $scope.prevDisabled;

			};


			/**
			 * Expose active index (exernal)
			 */
			this.getActiveIndex = function() {

				return $scope.repeater.activeIndex;

			};


			/**
			 * Expose repeater object
			 */
			this.getRepeater = function() {
				return $scope.repeater;
			};


			/**
			 * Swipe to
			 */
			this.swipeTo = function( index ) {
				$timeout( function() {
					$scope.repeater.swipeTo( index );
				});
			};

			this.stopInitializing = function() {
				$scope.initializing = false;
			};

		},
		template: function( elem, attrs ) {

			return "<div class='griot-field-wrap' data='data' ui='ui'>" +
				"<p class='griot-field-meta'><span class='griot-label'>" + attrs.label + "</span> <a class='griot-button' ng-click='add( model." + attrs.name + ", \"" + attrs.name + "\" )' >Add " + attrs.labelSingular + "</a></p>" +
				"<div class='griot-repeater'>" +
					"<div class='griot-repeater-header' ng-show='repeater.slides.length !== 0'>" +
						"<div class='griot-repeater-pagination'></div>" +
						"<span class='griot-repeater-nav griot-icon griot-icon-prev prev' ng-click='repeater.swipePrev()' ng-class=\"{'disabled':prevDisabled}\"></span>" +
						"<span class='griot-repeater-nav griot-icon griot-icon-next next' ng-click='repeater.swipeNext()' ng-class=\"{'disabled':nextDisabled}\"></span>" +
					"</div>" +
					"<div class='griot-repeater-container swiper-container'>" +
						"<div class='griot-repeater-wrapper swiper-wrapper'>" +
							"<div class='griot-repeater-item swiper-slide' ng-repeat='elem in model." + attrs.name + "'>" +
								"<div class='griot-repeater-meta-wrap'>"+
									"<span class='griot-repeater-meta'>" + attrs.labelSingular + "&nbsp;&nbsp;{{$index + 1}}&nbsp;&nbsp;of&nbsp;&nbsp;{{repeater.slides.length}}</span>" +
									"<a class='griot-repeater-menu-toggle griot-icon griot-icon-menu' ng-click='toggleMenu()' ng-class='{active:showMenu}'></a>" +
									"<div class='griot-repeater-menu' ng-show='showMenu'>" +
										"<div class='griot-repeater-menu-option'>" +
											"<a class='griot-repeater-menu-option-icon griot-icon griot-icon-delete' ng-click='remove(model." + attrs.name + ", $index)'></a>" +
											"<a class='griot-repeater-menu-option-label' ng-click='remove(model." + attrs.name + ", $index)'>Delete " + attrs.labelSingular + "</a>" +
										"</div>" +											
										"<div class='griot-repeater-menu-option' ng-class='{disabled:$index === 0}'>" +
											"<a class='griot-repeater-menu-option-icon griot-icon griot-icon-shiftleft' ng-click='rearrange(model." + attrs.name + ", $index, $index - 1)'></a>" +
											"<a class='griot-repeater-menu-option-label' ng-click='rearrange(model." + attrs.name + ", $index, $index - 1)'>Shift left</a>" +
										"</div>" +
										"<div class='griot-repeater-menu-option' ng-class='{disabled:$index === repeater.slides.length - 1}'>" +
											"<a class='griot-repeater-menu-option-icon griot-icon griot-icon-shiftright' ng-click='rearrange(model." + attrs.name + ", $index, $index + 1)'></a>" +
											"<a class='griot-repeater-menu-option-label' ng-click='rearrange(model." + attrs.name + ", $index, $index + 1)'>Shift right</a>" +
										"</div>" +
									"</div>" +
								"</div>" +
								"<div class='griot-repeater-fields' ng-transclude></div>" +
							"</div>"+
						"</div>" +
					"</div>" +
				"</div>" +
			"</div>"; 

		},
		link: function( scope, elem, attrs ) {

			var _this = this;
			
			// Register repeater array in main data object
			scope.register( attrs.name );

			// Build repeater
			scope.build( elem );

			// Initialize nav
			scope.refreshNav();

			// Close menu on click outside of element
			jQuery( window ).on( 'click', function( e ) {

				var thisMenu = elem.find( '.griot-repeater-meta-wrap' );

				if( ! jQuery( e.target ).closest( '.griot-repeater-meta-wrap' ).is( thisMenu ) ) {

					scope.$apply(
						scope.showMenu = false
					);

				}

			});

			// Watch for external changes to data object and apply
			scope.$watchCollection( 

				function() {
					return scope.model[ attrs.name ];
				},
				function() {

					// Wait 10ms in case this is part of a batch delete
					window.clearTimeout( _this.checkModel );
					_this.checkModel = window.setTimeout( function(){

						scope.refresh();

					}, 10 );

				}

			);

		}

	};

});
angular.module( 'griot' ).directive( 'switch', function( ModelChain ) {
	
	return {

		restrict: 'E',
		replace: true,
		controller: function( $scope, $element, $attrs ) {

			$scope.model = ModelChain.getModel( $scope );

			$scope.model[ $attrs.name ] = $scope.model[ $attrs.name ] ? $scope.model[ $attrs.name ] : $attrs.default;

			$scope.switchers = $scope.hasOwnProperty( 'switchers' ) ? $scope.switchers : {};

			$scope.switchers[ $attrs.name ] = {

				default: $attrs.default,
				types: []

			};

			this.registerType = function( type, label ) {

				if( -1 === $scope.switchers[ $attrs.name ].types.indexOf( type ) ) {
					$scope.switchers[ $attrs.name ].types.push({
						name: type,
						label: label
					});
				}
				console.log( 'Registered ' + type );
				console.log( $scope.switchers[ $attrs.name ].types );

			};

			this.getSwitchName = function() {
				return $attrs.name;
			};

		},
		template: function( elem, attrs ) {

			var transcrude = elem.html();

			var templateHtml = "<div class='griot-switch-wrap'>" +
				"<div class='griot-field-wrap'>" +
					"<div class='griot-field-meta'>" +
						"<span class='griot-label'>" + attrs.label + "</span>" +
						"<select ng-model='model[ \"" + attrs.name + "\" ]' ng-options='type.name as type.label for type in switchers." + attrs.name + ".types'></select>" +
					"</div>" +
				"</div>" +
				transcrude +
			"</div>";

			return templateHtml;

		},
		link: function( scope, elem, attrs ) {



		}

	};

});
angular.module( 'griot' ).directive( 'switchgroup', function( $compile, ModelChain ) {
	
	return {

		restrict: 'E',
		replace: true,
		require: '^switch',
		controller: function( $scope, $element, $attrs ) {

			$scope.isCurrentType = function( type ) {

				return type === $scope.model[ $scope.switchName ];

			};

		},
		template: function( elem, attrs ) {

			var transcrude = elem.html();
			var templateHtml = "<div class='griot-switch-item' ng-show='isCurrentType(\"" + attrs.type + "\")'>" + transcrude + "</div>";
			return templateHtml;

		},
		link: function( scope, elem, attrs, switchCtrl ) {

			scope.switchName = switchCtrl.getSwitchName();

			switchCtrl.registerType( attrs.type, attrs.label );

		}

	};

});
/**
 * <zoomer> directive
 *
 * Sets up a (non-isolate) scope and controller and prints fields needed to
 * add and annotate zoomable images.
 */
angular.module( 'griot' ).directive( 'zoomer', function( $http, ModelChain ) {

	return {

		restrict: 'E',
		replace:true,
		template: function( elem, attrs ) {

			var transcrude = elem.html();
			attrs.hasAnnotations = transcrude ? true : false;

			var templateHtml = "<div class='griot-annotated-image'>" +
				"<field type='zoomerselector' object='" + attrs.object + "' name='" + attrs.name + "' />" +
				"<div class='griot-zoomer griot-prevent-swipe' id='zoomer" + Math.floor( Math.random() * 1000000 ) + "-{{$id}}' ng-class='{ hasAnnotations: hasAnnotations, noAnnotations: !hasAnnotations }' />";

			if( transcrude ) {

				templateHtml +=	"<repeater annotations label='" + attrs.annotationsLabel + "' name='" + attrs.annotationsName + "' label-singular='" + attrs.annotationsLabelSingular + "' label-plural='" + attrs.annotationsLabelPlural + "'>" +
						transcrude +
					"</repeater>";

			}

			templateHtml += "</div>";

			return templateHtml;

		},
		controller: function( $scope, $element, $attrs, $timeout ) {

			var _this = this;

			/**
			 * Check to see if image ID leads to tiles
			 */
			$scope.checkForTiles = function() {

				// Get new image ID from model
				var newImageID = $scope.model[ $attrs.name ];

				// Do nothing if zoomer exists and image ID has not changed
				if( newImageID === $scope.imageID && 'undefined' !== typeof $scope.zoomer ) {
					return;
				}

				// Return if image ID is blank
				if( ! newImageID ) { 
					_this.destroyZoomer( true );
					return;
				}

				// Build tile server URL
				$scope.tilejson = $scope.ui.tileServer + newImageID + '.tif';

				// Get tile data if it exists and build or destroy zoomer accordingly
				var http = $http.get( $scope.tilejson );
				http.success( function( tileData ) { 

					$scope.tileData = tileData;

					// Hard destroy
					_this.destroyZoomer( true );

					// Setup and build
					_this.setupZoomer( true );

				});
				http.error( function( e ) {

					_this.destroyZoomer( true );

				});

			};


			/**
			 * Build zoomer
			 */
			this.setupZoomer = function( buildZoomer ) {

				if( 'undefined' === typeof buildZoomer ){
					buildZoomer = false;
				}

				$scope.imageID = $scope.model[ $attrs.name ];

				// Necessary?
				$scope.tilesURL = $scope.tileData.tiles[0].replace( 'http://0', '//0' );

				// Get container ID
				// NOTE: Can't get it on init, because the {{index}} component will 
				// not have been interpolated by Angular yet
				$scope.container_id = $element.find( '.griot-zoomer' ).first().attr( 'id' );

				if( buildZoomer ){
					if( $scope.isVisible() ){
						$scope.buildZoomer();
					}
				}

			};

			$scope.buildZoomer = function(){

				$scope.imageLayers = L.featureGroup();

				// Build zoomer and store instance in scope
				$scope.zoomer = Zoomer.zoom_image({
					container: $scope.container_id,
					tileURL: $scope.tilesURL,
					imageWidth: $scope.tileData.width,
					imageHeight: $scope.tileData.height
				});

				$scope.zoomer.map._zoomAnimated = false;

				// Add feature group to zoomer
				$scope.zoomer.map.addLayer( $scope.imageLayers );

				_this.loadImageAreas();

				if( $scope.hasAnnotations ) {

					_this.addDrawingControls();

					_this.watchForExternalDeletion();

				}
			};


			/**
			 * Destroy zoomer
			 *
			 * If 'destroyData' is false, the zoomer object and map are destroyed, but
			 * the data in the model is unaffected.
			 */
			this.destroyZoomer = $scope.destroyZoomer = function( destroyData ) {

				if( 'undefined' === typeof destroyData ){
					destroyData = false;
				}

				if( ! $scope.zoomer ) {
					return;
				}

				$scope.zoomer.map.remove();
				delete $scope.zoomer;
				delete Zoomer.zoomers[ $scope.container_id ];
				
				if( destroyData ){
					$element.find( '.griot-zoomer' ).empty();
					$scope.imageID = null;
					$scope.model.annotations = [];

					// Unnecessary and throws an error on image ID change.
					// watchForExternalDeletion will take care of removing image layers.
					//$scope.imageLayers = null;
				}

			};


			/**
			 * Load previously saved image areas
			 */
			this.loadImageAreas = function() {

				angular.forEach( this.getAnnotations(), function( annotation ) {

					// Grab geoJSON stored in annotation
					var geoJSON = annotation.geoJSON;

		    	// Convert geoJSON to layer
		    	var layer = L.GeoJSON.geometryToLayer( geoJSON.geometry );

		    	// Store annotation in layer
					layer.annotation = annotation;

					// Add to local image layers collection
					$scope.imageLayers.addLayer( layer );

				});

			};


			/**
			 * Create drawing control object and append to zoomer
			 */
			this.addDrawingControls = function() {

				var drawControl = new L.Control.Draw({

		      draw: {
		        circle: false,
		        polyline: false,
		        marker: false,
		        rectangle: {
		        	shapeOptions: {
		        		color: '#eee'
		        	}
		       	}
		      },
		      edit: {
		      	featureGroup: $scope.imageLayers
		      }

		    });

		    $scope.zoomer.map.addControl( drawControl );

			};


			/**
			 * If a user deletes an annotation using the repeater, remove the layer 
			 * from the zoomer.
			 */
			this.watchForExternalDeletion = function() {

				$scope.$watchCollection(

					function() {

						return _this.getAnnotations();

					},
					function() {

						if( 'undefined' === typeof $scope.zoomer ) {
							return;
						}

						angular.forEach( $scope.imageLayers._layers, function( layer ) {

							if( -1 === jQuery.inArray( layer.annotation, _this.getAnnotations() ) ) {

								$scope.imageLayers.removeLayer( layer );

							}

						});

					}

				);

			};


			/**
			 * Retrieve the zoomer instance
			 */
			this.getZoomer = function() {
				return $scope.zoomer ? $scope.zoomer : null; 
			};


			/**
			 * Retrieve the reference to the annotations repeater
			 */
			this.getAnnotations = function() {
				return $scope.model[ $attrs.annotationsName ];
			};

			$scope.zoomOut = function() {
				if( 'undefined' !== typeof $scope.zoomer.map ) {
					$scope.zoomer.map.centerImageAtExtents();
				}
			};

			$scope.hasMap = function() {
				if( $scope.zoomer ) {
					return true;
				} else {
					return false;
				}
			};

			this.getScope = function() {
				return $scope;
			};

			this.getImageLayers = function() {
				return $scope.imageLayers;
			};

			$scope.isVisible = function() {

				var visible = true;

				// Walk up the parents - abort if a parent is a swiper slide that is not active
				$element.parents().each( function( i, el ){
					if( $(el).hasClass( 'griot-repeater-item' ) && ! $(el).hasClass( 'swiper-slide-active' ) ){
						visible = false;
					}
				});

				return visible;
			};

		},
		link: function( scope, elem, attrs ) {

			ModelChain.bypassModel( scope );

			scope.hasAnnotations = attrs.hasAnnotations;

			// Get reference to image id
			scope.imageID = scope.model[ attrs.name ];

			// Set up zoomers
			scope.checkForTiles();

			// Destroy and rebuild if ID changes
			// TODO: Need to call buildZoomer somehow, after tiles loaded
			elem.find( 'select' ).on( 'change', function() {
				console.log('changed');
				scope.checkForTiles();
			});

			scope.$on( 'slidesReady', function(){
				if( scope.isVisible() ){
					setTimeout( function(){
						if( 'undefined' === typeof scope.zoomer ){
							scope.buildZoomer();
						}
					}, 500 );
				}
			});

			scope.$on( 'slideChange', function(){
				if( 'undefined' !== typeof scope.zoomer ){
					scope.destroyZoomer( false );
				}

				if( scope.isVisible() && 'undefined' === typeof scope.zoomer ){
					scope.buildZoomer();
				}				
			});

		}

	};

});


/**
 * Extend Leaflet
 */
L.extend( L.LatLngBounds.prototype, {

  toGeoJSON: function() {

    L.Polygon.prototype.toGeoJSON.call( this );

  },

  getLatLngs: function() {

    L.Polygon.prototype._convertLatLngs([
      [this.getSouthWest().lat, this.getSouthWest().lng],
      [this.getNorthWest().lat, this.getNorthWest().lng],
      [this.getNorthEast().lat, this.getNorthEast().lng],
      [this.getSouthEast().lat, this.getSouthEast().lng]
    ]);

  }

});
/**
 * ModelChain service
 *
 * Tells nested fields and repeaters where in the $scope.data object to store
 * their data.
 * 
 * The 'modelChain' and 'model' parameters are stored in each directive's
 * (isolated) scope and updated based on the parent scope's value. 
 * 
 * modelChain maintains an array representing the chain of elements above the 
 * current field element, i.e. ['data', 'repeater1', '0', 'repeater2', '1', 
 * 'fieldname' ]. model converts modelChain into a reference to the proper
 * storage location in $scope.data. 
 * 
 * NOTE: model in fact resolves to the level just above the field name, so 
 * that the directive template can define ng-model as 'model.fieldname' and 
 * Angular can interpret it correctly. If one were to assign to model a 
 * reference to the actual property (rather than its parent) and elegantly 
 * define ng-model as 'model', Angular would not evaluate the path and would
 * instead bind the field to the property on the LOCAL scope called 'model'.
 * Many Bothans died to bring us this information.
 */
angular.module( 'griot' ).factory( 'ModelChain', function() {

	return {

		/**
		 * Initialize the model chain with 'data' value.
		 * (Called in main controller)
		 */
		initialize: function( scope ) {

			scope.modelChain = ['data'];
			scope.model = scope.data;

		},

		/**
		 * Update modelChain and model and store in local scope. Intended for use
		 * in directives with isolate scope.
		 */
		updateModel: function( scope, name ) {

			// Get parent scope modelChain
			scope.modelChain = angular.copy( scope.$parent.modelChain );

			// Check if this directive is the child of a repeater
			// If so, push repeater item index into model chain
			if( typeof scope.$parent.$index !== "undefined" ) {
				scope.modelChain.push( scope.$parent.$index );
			}

			// NOTE: Technically this returns the local scope, but the directives in
			// which we use this service always define scope.data as referring to
			// the parent scope, all the way to the root, so it works.
			scope.model = scope;

			// Cycle through model chain to create reference to correct location in
			// main data object.
			for( var i = 0; i < scope.modelChain.length; i++ ) {
				scope.model = scope.model[ scope.modelChain[ i ] ];
			}

			// After model has been created (without the field name), add field
			// name to model chain so children receive the complete path.
			scope.modelChain.push( name );

		},

		/**
		 * Get the current model without modifying scope. Intended for use within
		 * directives with non-isolate scope, e.g. annotatedimage directive, so
		 * one can interact with data without polluting the model chain.
		 */
		getModel: function( scope ) {

			// Get parent scope modelChain
			var modelChain = angular.copy( scope.$parent.modelChain );

			// Check if this directive is within a repeater item.
			// If so, push repeater item index into model chain.
			// NOTE: Not checking $parent because non-isolate scope would be shared
			// with repeater item.
			if( typeof scope.$index !== "undefined" ) {
				modelChain.push( scope.$index );
			}

			// Create reference to scope
			var model = scope;

			// Cycle through model chain to create reference to correct location in
			// main data object.
			for( var i = 0; i < modelChain.length; i++ ) {
				model = model[ modelChain[ i ] ];
			}

			return model;

		},

		/**
		 * Bypass model
		 */
		bypassModel: function( scope ) {

			scope.modelChain = angular.copy( scope.$parent.modelChain );

			// Check if this directive is the child of a repeater
			// If so, push repeater item index into model chain
			if( typeof scope.$parent.$index !== "undefined" ) {
				scope.modelChain.push( scope.$parent.$index );
			}

			scope.model = scope;

			for( var i = 0; i < scope.modelChain.length; i++ ) {
				scope.model = scope.model[ scope.modelChain[ i ] ];
			}

		}

	};

});