var isAndroid = Ti.Platform.osname == 'android';

if (isAndroid) {
	// Landscape Mode
	var screenWidth = Ti.Platform.displayCaps.platformHeight;
	var screenHeight = Ti.Platform.displayCaps.platformWidth;
} else {
	var screenWidth = Ti.Platform.displayCaps.platformWidth;
	var screenHeight = Ti.Platform.displayCaps.platformHeight;
}

var MAX_ZOOM = 1.0;
var MIN_ZOOM = 0.35;
var DELTA_ZOOM = MAX_ZOOM - MIN_ZOOM;

var MIN_Y = Math.floor(screenHeight / 6);
var MAX_Y = Math.floor(screenHeight / 4 * 3);
var DELTA_Y = MAX_Y - MIN_Y;

// Setup the location  properties for callbacks
Ti.Geolocation.headingFilter = 1;
Ti.Geolocation.showCalibration = false;

if (isAndroid) {
	Ti.Geolocation.Android.accuracy = Ti.Geolocation.ACCURACY_HIGH;
	Ti.Geolocation.accuracy = Ti.Geolocation.ACCURACY_HIGH;
} else {
	Ti.Geolocation.distanceFilter = 10;
	Ti.Geolocation.preferredProvider = "gps";
	Ti.Geolocation.accuracy = Ti.Geolocation.ACCURACY_NEAREST_TEN_METERS;
	Ti.Geolocation.purpose = "Augmented Reality";
}

// function to create the window
exports.createARWindow = function(params) {

	function showAR() {
		Ti.Geolocation.addEventListener('heading', headingCallback);
		Ti.Geolocation.addEventListener('location', locationCallback);
		Ti.Media.showCamera({
			success : function(event) {
			},
			cancel : function() {
				// only gets called if Android
				closeAR();
			},
			error : function(error) {
				alert('unable to open AR Window');
				closeAR();
			},
			mediaTypes : [Ti.Media.MEDIA_TYPE_VIDEO, Ti.Media.MEDIA_TYPE_PHOTO],
			showControls : false,
			autohide : false,
			autofocus : "off",
			animated : false,
			overlay : overlay
		});
	}

	function closeAR() {
		Ti.Geolocation.removeEventListener('heading', headingCallback);
		Ti.Geolocation.removeEventListener('location', locationCallback);
		if (!isAndroid) {
			Ti.Media.hideCamera();
		}
		setTimeout(function() {
			win.close();
		}, 500);
	}

	var views = [];
	// background colors for debugging
	var showColors = false;
	var colors = ['red', 'yellow', 'pink', 'green', 'purple', 'orange', 'blue', 'aqua', 'white', 'silver'];

	var numberOfViews = 9;
	var myLocation = null;

	// Create the main view - only as wide as the viewport
	var overlay = Ti.UI.createView({
		top : 0,
		height : screenHeight,
		left : 0,
		width : screenWidth,
		backgroundColor : 'transparent'
	});

	// Create all the view that will contain the points of interest
	for (var i = 0; i < numberOfViews; i++) {
		// create a view 1.6x the screen width
		// they will overlap so any poi view that
		// are near the edge will continue over into the
		// 'next' view.
		views[i] = Ti.UI.createView({
			top : 0,
			height : screenHeight,
			right : 0,
			width : screenWidth * 1.6,
			visible : false
		});

		if (showColors) {
			views[i].backgroundColor = colors[i];
			views[i].opacity = 0.5;
		}

		overlay.add(views[i]);
	};

	var label = Ti.UI.createLabel({
		bottom : '20dp',
		height : '20dp',
		text : "",
		textAlign : 'center',
		color : 'white',
		backgroundColor : 'black',
		opacity : 0.5,
		font : {
			fontSize : '12dp'
		}
	});

	overlay.add(label);

	var radar = Ti.UI.createView({
		backgroundImage : '/images/radar.png',
		width : '80dp',
		height : '80dp',
		bottom : '10dp',
		left : '10dp',
		opacity : 0.7
	});

	overlay.add(radar);

	if (params.overlay) {
		overlay.add(params.overlay);
	}

	if (!isAndroid) {

		var button = Ti.UI.createButton({
			top : '5dp',
			right : '5dp',
			height : '45dp',
			width : '45dp',
			backgroundImage : '/images/close.png'
		});

		button.addEventListener('click', closeAR);

		overlay.add(button);

	}

	var lastActiveView = -1;
	var viewChange = false;
	var centerY = screenHeight / 2;
	var activePois;

	function headingCallback(e) {
		var currBearing = e.heading.trueHeading;
		var internalBearing = currBearing / (360 / views.length);
		var activeView = Math.floor(internalBearing);
		var pixelOffset = screenWidth - (Math.floor((internalBearing % 1) * screenWidth));

		if (activeView != lastActiveView) {
			viewChange = true;
			lastActiveView = activeView;
		} else {
			viewChange = false;
		}

		for (var i = 0; i < views.length; i++) {
			var diff = activeView - i;
			if (diff >= -1 && diff <= 1) {
				views[i].center = {
					y : centerY,
					x : pixelOffset + (-1 * diff * screenWidth)
				}
				if (viewChange) {
					views[i].visible = true;
				}
			} else {
				if (viewChange) {
					views[i].visible = false;
				}
			}
		}

		if (activeView == 0) {
			views[views.length - 1].center = {
				y : centerY,
				x : views[0].center.x - screenWidth
			};
			if (viewChange) {
				views[views.length - 1].visible = true;
			}
		} else if (activeView == (views.length - 1 )) {
			views[0].center = {
				y : centerY,
				x : views[views.length - 1].center.x + screenWidth
			};
			if (viewChange) {
				views[0].visible = true;
			}
		}

		// REM this if you don't want the user to see their heading
		label.text = Math.floor(currBearing) + "\xB0";

		// Rotate the radar
		radar.transform = Ti.UI.create2DMatrix().rotate(-1 * currBearing);

	}

	// Just a container window to hold all these objects
	// user will never know
	var win = Ti.UI.createWindow({
		modal : true,
		navBarHidden : true,
		fullscreen : true,
		orientationModes : [Ti.UI.PORTRAIT]
	});

	if (params.maxDistance) {
		win.maxDistance = params.maxDistance;
	}

	win.doClose = function() {
		closeAR();
	};

	win.addEventListener('open', function() {
		Ti.API.debug('AR Window Open...');
		setTimeout(showAR, 500);
	});

	win.assignPOIs = function(pois) {
		win.pois = pois;
		// TODO - something here to make sure the pois redraw
		// even if the location doesn't update
	}
	function poiClick(e) {
		Ti.API.debug('heard a click');
		Ti.API.debug('number=' + e.source.number);
		var poi = activePois[e.source.number];
		var view = poi.view;
		view.fireEvent('click', {
			source : poi.view,
			poi : poi
		});
	}

	function locationCallback(e) {
		myLocation = e.coords;
		redrawPois();
	};

	function redrawPois() {

		if (!myLocation) {
			Ti.API.warn("location not known. Can't draw pois");
			return;
		}

		// remove any existing views
		for (var i = 0; i < views.length; i++) {
			var view = views[i];
			if (view.children) {
				if (view.children.length > 0) {
					for (var j = view.children.length; j > 0; j--) {
						try {
							view.remove(view.children[j - 1]);
						} catch (e) {
							Ti.API.error('error removing child ' + j + ' from view');
						}
					}
				}
			}
		}

		if (radar.children.length > 0) {
			for (var j = radar.children.length; j > 0; j--) {
				try {
					radar.remove(view.children[j - 1]);
				} catch (e) {
					Ti.API.error('error removing child ' + j + ' from radar');
				}
			}
		}

		// Draw the Points of Interest on the Views
		activePois = [];

		for (var i = 0; i < win.pois.length; i++) {
			var poi = win.pois[i];
			if (poi.view) {
				var distance = exports.calculateDistance(myLocation, poi);
				var addPoint = true;
				if (win.maxDistance && distance > win.maxDistance) {
					addPoint = false;
				}
				if (addPoint) {
					var bearing = exports.calculateBearing(myLocation, poi);
					var internalBearing = bearing / (360 / views.length);
					var activeView = Math.floor(internalBearing);
					if (activeView >= views.length) {
						activeView = 0;
					}
					var pixelOffset = Math.floor((internalBearing % 1) * screenWidth) + ((views[0].width - screenWidth) / 2);
					poi.distance = distance;
					poi.pixelOffset = pixelOffset;
					poi.activeView = activeView;
					poi.bearing = bearing;
					activePois.push(poi);
				} else {
					Ti.API.debug(poi.title + " not added, maxDistance=" + win.maxDistance);
				}
			}

		}

		// Sort by Distance
		activePois.sort(function(a, b) {
			return b.distance - a.distance;
		});

		var maxDistance = activePois[0].distance;
		var minDistance = activePois[activePois.length - 1].distance;
		var distanceDelta = maxDistance - minDistance;

		// Add the view
		for (var i = 0; i < activePois.length; i++) {
			var poi = activePois[i];
			Ti.API.debug(poi.title);
			if (showColors) {
				Ti.API.debug('viewColor=' + views[poi.activeView].backgroundColor);
			}
			Ti.API.debug('bearing=' + poi.bearing);
			// Calcuate the Scaling (for distance)
			var distanceFromSmallest = poi.distance - minDistance;
			var percentFromSmallest = 1 - (distanceFromSmallest / distanceDelta);
			var zoom = (percentFromSmallest * DELTA_ZOOM) + MIN_ZOOM;
			// Calculate the y (farther away = higher )
			var y = MIN_Y + (percentFromSmallest * DELTA_Y);
			var view = poi.view;
			// Apply the transform
			var transform = Ti.UI.create2DMatrix();
			transform = transform.scale(zoom);
			view.transform = transform;
			Ti.API.debug('pixelOffset=' + poi.pixelOffset);
			view.center = {
				x : poi.pixelOffset,
				y : y
			};

			// Testing Click Handlers
			if (view.clickHandler) {
				view.clickHandler.removeEventListener('click', poiClick);
				view.remove(view.clickHandler);
				view.clickHandler = null;
			}
			var clickHandler = Ti.UI.createView({
				width : Ti.UI.FILL,
				height : Ti.UI.FILL
			});
			var number = i;
			clickHandler.number = number;
			clickHandler.addEventListener('click', poiClick);
			view.add(clickHandler);
			view.clickHandler = clickHandler;

			views[poi.activeView].add(view);

			Ti.API.debug('viewSize=' + view.width + "," + view.height);

			// need to create a second click handler
			// on the closest view in case there is overlap
			var clickHandler2 = Ti.UI.createView({
				width : view.width,
				height : view.height,
				transform : transform
			});

			clickHandler2.number = number;
			clickHandler2.addEventListener('click', poiClick);

			var nextView;
			var nextOffset;
			if (poi.pixelOffset > (views[0].width / 2 )) {
				nextView = poi.activeView + 1;
				nextOffset = poi.pixelOffset - screenWidth;
			} else {
				nextView = poi.activeView - 1;
				nextOffset = poi.pixelOffset + screenWidth;
			}

			if (nextView < 0) {
				nextView = views.length - 1;
			} else if (nextView == views.length) {
				nextView = 0;
			}

			Ti.API.debug('nextView=' + nextView);
			Ti.API.debug('nextOffset=' + nextOffset);

			clickHandler2.center = {
				x : nextOffset,
				y : y
			};
			views[nextView].add(clickHandler2);
			// End Click Handlers

			// add to blip to the radar
			// The Radar Blips ....
			var rad = toRad(poi.bearing);
			var relativeDistance = poi.distance / (maxDistance * 1.2);
			var centerX = (40 + (relativeDistance * 40 * Math.sin(rad)));
			var centerY = (40 - (relativeDistance * 40 * Math.cos(rad)));

			var displayBlip = Ti.UI.createView({
				height : '3dp',
				width : '3dp',
				backgroundColor : 'white',
				borderRadius : 2,
				top : (centerY - 1) + "dp",
				left : (centerX - 1) + "dp"
			});
			radar.add(displayBlip);

		}

	};

	if (params.pois) {
		win.assignPOIs(params.pois);
	}

	return win;

};

function toRad(val) {
	return val * Math.PI / 180;
};

exports.calculateBearing = function(point1, point2) {
	var lat1 = toRad(point1.latitude);
	var lat2 = toRad(point2.latitude);
	var dlng = toRad((point2.longitude - point1.longitude));
	var y = Math.sin(dlng) * Math.cos(lat2);
	var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dlng);
	var brng = Math.atan2(y, x);
	return ((brng * (180 / Math.PI)) + 360) % 360;
};

exports.calculateDistance = function(loc1, loc2) {
	var R = 6371;
	// Radius of the earth in km
	var dLat = (toRad(loc2.latitude - loc1.latitude));
	// Javascript functions in radians
	var dLon = (toRad(loc2.longitude - loc1.longitude));
	var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(loc1.latitude)) * Math.cos(toRad(loc2.latitude)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	// Distance in m
	return R * c * 1000;
};

