//globals
const contentArea = document.getElementById('content');
const btnHelp = document.getElementById('help_mode');
const btnViewMode = document.getElementById('view_mode');
const btnPinMode = document.getElementById('pin_mode');
const btnRouteMode = document.getElementById('route_mode');
const btnFormClose = document.getElementById('form_close');
const btnRequestDelete = document.getElementById('request_delete_button');
const elevationContainer = document.getElementById('elevation_container');
const errorContainer = document.getElementById('error_toast');
let map;
let pageMode = 'view';
let drawingManager = null;
var selectedShape;
let drawnShapes = [];
let selectedNewMarker = null;
let locations = [];
let routes = [];
let allRouteMarkers = [];
let routeLabels = [];
const dotLabels = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const elevationWayPoints = 20;

// buttons
btnViewMode.addEventListener('click', function(e){
   toggleMode(e.target.name);
});
btnRouteMode.addEventListener('click', function(e){
    toggleMode(e.target.name);
});
btnPinMode.addEventListener('click', function(e){
    toggleMode(e.target.name);
});
btnHelp.addEventListener('click', function(){
    $('#helpTextModal').modal('show');
});
btnFormClose.addEventListener('click',function(){
    if(pageMode == 'pin'){
        if(selectedNewMarker != null){
            deleteMarker(selectedNewMarker);
        }
    }
    else if(pageMode == 'route'){
        deleteAllShapes();
    }
});


// database call for locations (callback after map initialised)
function getLocations(){
    $.get("./php/getLocations.php").done(function(data){
        // handle errors, get JSON
        if(data == '0 results'){
            throwPageError(data);
        } 
        else {
            let queryResults = JSON.parse(data);
            console.log(queryResults);
            // sort into locations & routes => put into global vars
            formatResults(queryResults);
            // display map
            initMap();
        }
    });
}
function formatResults(results){
    results.forEach(result => {
        // dot markers
        if(result.lat != null && result.lng != null){
            locations.push(result)
        }
        // routes
        if(result.path != null){
            let route = {
                coords : [],
                elevations : [
                    ["x","elevation"]
                ],
                id: null,
                distance : null,
                name : null,
                level : null,
                type : null,
                surfacetype : null,
                isLoop : function(){
                    return (this.coords[0].lat == this.coords[this.coords.length-1].lat) && (this.coords[0].lng == this.coords[this.coords.length-1].lng);
                },
                southpoint : function(){
                    let southpoint = null;
                    let southpoint_lat = null
                    this.coords.forEach(c => {
                        if(southpoint_lat == null || c.lat < southpoint_lat){
                            southpoint_lat = c.lat;
                            southpoint = c;
                        }
                    });
                    return new google.maps.LatLng(southpoint.lat, southpoint.lng);;
                }
            };
            // make route coords array
            let points = result.path.split(',');
            points.forEach(point => {
                let pointObj = {
                    lat: parseFloat(point.split(' ')[0]),
                    lng: parseFloat(point.split(' ')[1])
                }
                route.coords.push(pointObj);
                
            });
            // make route elevation array
            if(result.elevation != null){
                let elevs = result.elevation.split(',');
                for(let i=0; i<elevs.length; i++){
                    let waypoint = round(((i+1)*elevationWayPoints)/1000);
                    route.elevations.push([`${waypoint.toString()} km`, parseInt(elevs[i])]);
                }
            }
            route.id = result.id;
            route.distance = result.distance;
            route.name = result.name;
            route.level = result.level;
            route.type = result.type;
            route.surfacetype = result.surfacetype;
            routes.push(route);  
        }
    })
}
// Define the overlay, derived from google.maps.OverlayView
function Label(opt_options) {
    // Initialization
    this.setValues(opt_options);
    
    // Label specific
    var span = this.span_ = document.createElement('p');
    span.style.cssText = 'position: relative; left: -50%; top: -8px; ' +
                        'white-space: nowrap; border: none; ' +
                        'padding: 2px; background-color: white';
    
    var div = this.div_ = document.createElement('div');
    div.appendChild(span);
    div.style.cssText = 'position: absolute; display: none; padding-top: 15px;';
    //drag
    div.draggable = true;
}
function initialiseLabelClass(){  
    Label.prototype = new google.maps.OverlayView();
    // Implement onAdd
    Label.prototype.onAdd = function() {
        var pane = this.getPanes().floatPane;
        pane.appendChild(this.div_);
        
        // Ensures the label is redrawn if the text or position is changed.
        var me = this;
        this.listeners_ = [
            google.maps.event.addListener(this, 'position_changed',
                function() { me.draw(); }),
            google.maps.event.addListener(this, 'text_changed',
                function() { me.draw(); }),
            google.maps.event.addDomListener(this.get('map').getDiv(),'mouseleave',function(){
                google.maps.event.trigger(this.div_,'mouseup');
            }),
            google.maps.event.addDomListener(this.div_,'mousedown',function(e){
                this.style.cursor='move';
                me.map.set('draggable',false);
                me.set('origin',e);

                me.moveHandler  = google.maps.event.addDomListener(me.get('map').getDiv(),'mousemove',function(e){
                    var origin = me.get('origin'),
                    left = origin.clientX-e.clientX,
                    top  = origin.clientY-e.clientY,
                    pos  = me.getProjection().fromLatLngToDivPixel(me.get('position')),
                    latLng = me.getProjection().fromDivPixelToLatLng(new google.maps.Point(pos.x-left, pos.y-top));
                    me.set('origin',e);
                    me.set('position',latLng);
                    me.draw();
                });
            }),
            google.maps.event.addDomListener(this.div_,'mouseup',function(){
                me.map.set('draggable',true);
                this.style.cursor='default';
                google.maps.event.removeListener(me.moveHandler);
              })
        ];
    };
    // Implement onRemove
    Label.prototype.onRemove = function() {
        var i, I;
        // remove label
        this.div_.parentNode.removeChild(this.div_);
        
        // Label is removed from the map, stop updating its position/text.
        for (i = 0, I = this.listeners_.length; i < I; ++i) {
            google.maps.event.removeListener(this.listeners_[i]);
        }
    };
    // Implement draw
    Label.prototype.draw = function() {
        var projection = this.getProjection();
        var position = projection.fromLatLngToDivPixel(this.get('position'));
        
        var div = this.div_;
        div.style.left = position.x + 'px';
        div.style.top = position.y + 'px';
        div.style.display = 'block';
        
        this.span_.innerHTML = this.get('text').toString();
    };
}

//initialise map
function initMap() {
    // set the nav buttons
    toggleMode('view');
    // initialise map
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 51.903614, lng: -8.468399 },
        zoom: 9,
    });
    // drawing controls
    drawingManager = new google.maps.drawing.DrawingManager({
        drawingMode: google.maps.drawing.OverlayType.MARKER,
        drawingControl: true,
        drawingControlOptions: {
            position: google.maps.ControlPosition.TOP_CENTER,
            drawingModes: [
                google.maps.drawing.OverlayType.POLYLINE,
            ],
        },
    });
    initialiseLabelClass();
    //initialise line chart
    
    // draw stuff on the map 
    drawDotMarkers();
    // load the chart package, then draw routes
    google.charts.load('current', {'packages':['corechart']});
    google.charts.setOnLoadCallback(drawRoutes);
    
    // map event listeners
    // add event listener: click on the map to add new dot & hide route labels
    map.addListener("click", (e) => {
        if(pageMode == 'pin'){
            placeMarkerAndPanTo(e.latLng, map);
        }
        hideAllRouteLabels();
    });

    // draw line complete
    google.maps.event.addListener(drawingManager, 'polylinecomplete', function(event) {
        
        // get the route coordinates & total distance
        let newRoute = '';
        let distance = 0;
        let addElevationStr = '';
        let dStart = null;
        event.getPath().getArray().forEach(point => {
            if(dStart != null){
                let dEnd = new google.maps.LatLng(point.lat(), point.lng());
                distance += google.maps.geometry.spherical.computeDistanceBetween(dStart, dEnd)
            }
            dStart = new google.maps.LatLng(point.lat(), point.lng());
            newRoute += `${point.lat()} ${point.lng()},`
        })
        let elevationSteps = Math.floor(distance / elevationWayPoints);
        distance = round(distance / 1000);
        newRoute = newRoute.slice(0, -1);
        // make an id string
        let idString = newRoute.split(",")[0];
        idString = idString.replace(/\s/g, '');

        // get route elevation
        const elevator = new google.maps.ElevationService();
        elevator.getElevationAlongPath({path: event.getPath().getArray(),samples: elevationSteps,},function(elevations,status){
            if (status !== "OK") {
                
                deleteAllShapes();
                // Show the error code inside the chartDiv.
                if(status == 'OVER_QUERY_LIMIT'){
                    throwPageError('An error occurred: route too long');    
                }
                else{
                    throwPageError(status);
                }
                return;
            }
            elevations.forEach(elevation =>{
                addElevationStr += `${elevation.elevation},`;
            })
            // remove trailing ,
            if(addElevationStr != ''){
                addElevationStr = addElevationStr.slice(0, -1);
            }
            
            // set form fields
            setFormToAdd();
            $('#locationPath').val(newRoute);
            $('#locationDistance').val(distance);
            $('#locationElevation').val(addElevationStr);
            $('#locationType').val("Route").change();
            $('#locationType').prop("disabled", true).change();
            $('#locationId').val(idString);
            // show modal
            $('#newLocationModal').modal('show');   
        });
    });

    // draw overlay complete
    google.maps.event.addListener(drawingManager, 'overlaycomplete', function(event) {
        stopDrawing();
        let newShape = event.overlay;
        newShape.type = event.type;
        drawnShapes.push(newShape);
    });
}

// draw existing data points
function drawDotMarkers(){
    // make dot markers
    const markers = locations.map((location, i) => {
        // get marker position
        let position = {
            lat: parseFloat(location.lat),
            lng: parseFloat(location.lng)
        }
        // draw the marker
        let marker = new google.maps.Marker({
            position: position,
            label: dotLabels[i % dotLabels.length],
            title: location.name,
        });
        // make the marker label
        constructDotMarkerLabel(location, marker);

        // event listener: right click to edit marker
        google.maps.event.addListener(marker,  'rightclick', function(){
            // match right clicked marker with marker info obj
            let location = null;
            let idString = `${this.position.lat()}${this.position.lng()}`;
            locations.forEach(l =>{
                if(l.id == idString){
                    location = l;
                }
            })
            // prepare & show the form
            if(location != null){
                setFormToUpdate(location);
                $('#locationType').prop("disabled", false).change();
                $('#newLocationModal').modal('show');
            }
        });

        return marker;
    });
    // Add a marker clusterer to manage the dot markers.
    new MarkerClusterer(map, markers, {
        imagePath:
        "https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m",
    });
}
function drawRoutes(){
    const routeMarkers = routes.map((route, i) => {
        // draw the route
        let routeMarker = new google.maps.Polyline({
            path: route.coords,
            geodesic: true,
            strokeColor: "#FF0000",
            strokeOpacity: 1.0,
            strokeWeight: 3,
            polylineID: route.id
        });
        allRouteMarkers.push(routeMarker);
        
        // make route visible on map
        routeMarker.setMap(map);

        // add event listener: click on route to show info label
        google.maps.event.addListener(routeMarker, 'click', function() {
            // hide all route labels
            hideAllRouteLabels();

            // clear & populate the elevation container
            elevationContainer.innerHTML = '';
            drawChart(route);

            //make the route info label
            constructRouteLabel(route, routeMarker, elevationContainer.innerHTML);
            
            // center map on the mid point of the route & zoom in 
            map.panTo(getHalfWayPoint(route.coords[0],route.coords[route.coords.length-1]));
            map.setZoom(13);

            // create an invisible marker & bind the label to it
            let labelMarker = new google.maps.Marker({  
                position: getBoundsPoints().labelAnchor,
                map: map,
                visible: false
            });
            this.label.bindTo('position', labelMarker, 'position');

            // make the start point markers visible
            if(!route.isLoop()){
                this.label.mark1.setVisible(true);
                this.label.mark2.setVisible(true);
            }
            //change selected route color
            routeMarker.setOptions({strokeColor: '#0bba31'})
            
            // make the selected route label visible
            this.label.setMap(map);

            
        });

        // add event listener: right click on route to edit route info
        google.maps.event.addListener(routeMarker, 'rightclick', function(){
            
            // match right clicked route to route info obj
            let route = null;
            routes.forEach(r => {
                if(r.id == this.polylineID){
                    route = r;
                }
            });
            // prepare & show the form
            if(route!= null){
                setFormToUpdate(route);
                $('#locationType').prop("disabled", true).change();
                $('#newLocationModal').modal('show');
            }
        });
    })
}

// place new dot marker
function placeMarkerAndPanTo(latLng, map) {
    // create the marker
    let marker = new google.maps.Marker({
      position: latLng,
      map: map,
      draggable: true
    });
    // center map on the new marker
    map.panTo(latLng);

    // make it the selected marker (delete any previously created ones)
    if(selectedNewMarker != null){
        deleteMarker(selectedNewMarker);
    }
    selectedNewMarker = marker;

     // add event listener: click on placed marker to enter info & submit
    marker.addListener("click", (e) => {
        let idString = `${e.latLng.lat()}${e.latLng.lng()}`;
        setFormToAdd();
        $('#locationLat').val(e.latLng.lat());
        $('#locationLong').val(e.latLng.lng());
        $('#locationId').val(idString);
        $('#locationType').prop("disabled", false).change();
        $('#newLocationModal').modal('show');
      });
}

// make info labels
function constructDotMarkerLabel(location, locationMarker) {
    const infowindow = new google.maps.InfoWindow({
      content: constructMarkerLabel(location, null),
    });
    routeLabels.push(infowindow);
    // add event listener: click on dot marker to open info window
    locationMarker.addListener("click", () => {
        hideAllRouteLabels();
        infowindow.open(locationMarker.get("map"), locationMarker);
    });
}
function constructRouteLabel(route, routeMarker, chart){
    let start1Marker = null;
    let start2Marker = null;
    // create share orientation markers
    if(!route.isLoop()){
        
        start1Marker = new google.maps.Marker({  
            position: route.coords[0],  
            map: map,
            label: '1',
            visible: false
        });
        start2Marker = new google.maps.Marker({  
            position: route.coords[route.coords.length-1],  
            map: map,
            label: '2',
            visible: false
        });
    }
    // create the route marker label
    routeMarker.label = new Label();
    routeMarker.label.set('text', constructMarkerLabel(route, chart));
    routeMarker.label.polylineID = route.id;
    if(!route.isLoop()){
        routeMarker.label.mark1 = start1Marker;
        routeMarker.label.mark2 = start2Marker;
    }
    routeLabels.push(routeMarker.label);
}

//  mode options
function toggleMode(mode){
    pageMode = mode;
    if(pageMode == 'view'){
        enableViewMode();
        disableDrawingMode();
        disablePinMode();
    }
    else if(pageMode == 'pin'){
        disableViewMode();
        disableDrawingMode();
        enablePinMode();
    }
    else if(pageMode == 'route'){
        disableViewMode();
        disablePinMode();
        enableDrawingMode();
    }
}
function enableDrawingMode(){
    btnRouteMode.disabled = true;
    btnRouteMode.className = "btn btn-info";
    drawingManager.setMap(map);
    startDrawing();
}
function disableDrawingMode(){
    btnRouteMode.disabled = false;
    btnRouteMode.className = "btn btn-outline-info";
    if(drawingManager!= null){
        
        drawingManager.setMap(null);
    }
    deleteAllShapes();
}
function enablePinMode(){
    btnPinMode.disabled = true;
    btnPinMode.className = "btn btn-info";
}
function disablePinMode(){
    btnPinMode.disabled = false;
    btnPinMode.className = 'btn btn-outline-info';
    if(selectedNewMarker != null){
        deleteMarker(selectedNewMarker);
    }
}
function enableViewMode(){
    btnViewMode.disabled = true;
    btnViewMode.className = "btn btn-info";
}
function disableViewMode(){
    btnViewMode.disabled = false;
    btnViewMode.className = "btn btn-outline-info";
}

// drawing functions
function stopDrawing(){
    drawingManager.setDrawingMode(null);
}
function startDrawing(){
    drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYLINE);
}

// form modes
function setFormToAdd(){
    // update form header & action
    document.getElementById('newLocationModalLabel').innerText = 'Add Location';
    document.getElementById('locationForm').action =  './php/addLocation.php';
    // clear all form fields
    clearForm();
    // delete form
    btnRequestDelete.hidden = true;
}
function setFormToUpdate(obj){
    //update form header & action
    document.getElementById('newLocationModalLabel').innerText = 'Update Location';
    document.getElementById('locationForm').action =  './php/updateLocation.php';
    // prefill values of selected location
    // surface checkboxes
    if(obj.surfacetype != null){
        let formCheckBoxes = document.getElementsByClassName('form-check-input');
        let conditions = obj.surfacetype.split(',');
        conditions.forEach(c => {
            [].forEach.call(formCheckBoxes, function (el) {
                if(c == el.value){
                    el.checked = true;
                }
            });
        });
    }
    $('#locationName').val(obj.name);
    $('#locationType').val(obj.type);
    $('#locationLevel').val(obj.level);
    $('#locationId').val(obj.id);
    // delete form
    $('#locationIdDelete').val(obj.id);
    $('#locationNameDelete').val(obj.name);
    btnRequestDelete.hidden = false;
}

// hide / delete stuff
function deleteMarker(marker){
    marker.setMap(null);
    marker = null;
}
function deleteAllShapes() {
    for (var i=0; i < drawnShapes.length; i++){
        drawnShapes[i].setMap(null);
    }
    drawnShapes = [];
}
function hideAllRouteLabels(){
    elevationContainer.innerHTML = '';
    routeLabels.forEach(l => {
        l.setMap(null);
        if(l.mark1){
            l.mark1.setVisible(false);
        }
        if(l.mark2){
            l.mark2.setVisible(false);
        }    
    });
    allRouteMarkers.forEach(rm =>{
        rm.setOptions({strokeColor: '#FF0000'});
    });
}
function clearForm(){
    $('#locationName').val(null);
    $('#locationType').val('Skate Park');
    $('#locationLevel').val('Beginner');
    let formCheckBoxes = document.getElementsByClassName('form-check-input');
    [].forEach.call(formCheckBoxes, function (el) {
        el.checked = false;
    });
}

// math
function round(num) {
    var m = Number((Math.abs(num) * 100).toPrecision(15));
    return Math.round(m) / 100 * Math.sign(num);
}
function getHalfWayPoint(start,end){
    let sLatLng = new google.maps.LatLng(start.lat, start.lng);
    let eLatLng = new google.maps.LatLng(end.lat, end.lng);
    return google.maps.geometry.spherical.interpolate(sLatLng, eLatLng, 0.5);  
}
function getBoundsPoints(){
    let ne = map.getBounds().getNorthEast();
    let sw = map.getBounds().getSouthWest();
    let nw = new google.maps.LatLng(ne.lat(), sw.lng());
    let se = new google.maps.LatLng(sw.lat(), ne.lng());
    let midN = google.maps.geometry.spherical.interpolate(nw, ne, 0.5); 
    let midS = google.maps.geometry.spherical.interpolate(sw, se, 0.5);
    let midW = google.maps.geometry.spherical.interpolate(nw, sw, 0.5);
    let midE = google.maps.geometry.spherical.interpolate(ne, se, 0.5);
    let labelAnchor = google.maps.geometry.spherical.interpolate(nw, ne, 0.8); 

    return {
        ne : ne,
        sw : sw,
        nw : nw,
        se : se,
        midN : midN,
        midS : midS,
        midW : midW,
        midE : midE,
        labelAnchor : labelAnchor
    }

}

// formatting
function constructMarkerLabel(obj, chart){
    
    let isLoop = false;
    if(obj.type == 'Route'){
        // determine if the route is a loop
        isLoop = obj.isLoop() ? true : false;
    }
    let shareURL = '';
    let shareURLEnd = '';
    let button1text = ((obj.type != 'Route')||(obj.type == 'Route' && isLoop)) ? 'copy' : '1';

    // info label
    let mString = `<center><img src="./img/info.svg"></center>
        <div class="row">
        <div class="col">
        <ul class="list-group list-group-flush">`;
    // name
    mString += `<li class="list-group-item"><b>${obj.name}</b></li>`;
    // type
    mString += `<li class="list-group-item">Type: ${obj.type}</li>`;
    // level
    mString += `<li class="list-group-item">Level: ${obj.level}</li>`

    if(obj.type == 'Route'){
        // distance
        mString += `<li class="list-group-item">ca. ${obj.distance}km`;
    
        if(!isLoop){
            mString += ` one way (${round(obj.distance * 2)}km total)`;
            // share url(s) for routes
            shareURLEnd = `https://www.google.com/maps/search/?api=1&query=${obj.coords[obj.coords.length-1].lat}%2C${obj.coords[obj.coords.length-1].lng}`;
        }
        mString += '</li>';
        shareURL = `https://www.google.com/maps/search/?api=1&query=${obj.coords[0].lat}%2C${obj.coords[0].lng}`;
    }
    else{
        // spot share url
        shareURL =`https://www.google.com/maps/search/?api=1&query=${obj.lat}%2C${obj.lng}`
    }
    // surface options
    if(obj.surfacetype != null){
        let conditions = obj.surfacetype.split(',');
        mString += `<li class="list-group-item">Surface: `;
        conditions.forEach(c =>{
            mString += `<span class="badge bg-info">${c}</span>`;
        });
        mString += `</li>`;
    }
    
    //copy coordinates
    mString += `<li class="list-group-item">Copy coordinates `;
    mString += `<input hidden type="text" class="form-control" value=${shareURL} id="share_url" readonly>
    <button type="button" class="btn btn-primary btn-sm" id="url-button-addon" name="route_start" onclick="copyUrl(this)">${button1text}</button>`;
    if(obj.type == 'Route' && !isLoop){
        // mString += `Start point 2`;
        mString += `<input hidden type="text" class="form-control" value=${shareURLEnd} id="share_url_end" readonly >
        <button type="button" class="btn btn-primary btn-sm" id="url-button-addon-end" name="route_end" onclick="copyUrl(this)">2</button>`;
    }
    mString += `</li>`;
    
    // elevation container
    if(obj.type == 'Route' && chart != null){ 
        mString+= `<li class="list-group-item"> Elevation Profile
        <div class="elevation_containers">${chart}</div></li>`;
    }
    mString += `</ul>`;
    mString += `</div></div>`;
    
    return mString;
}
function copyUrl(e){
    let urlLbl = null;
    if(e.name == 'route_start'){
        urlLbl = document.getElementById("share_url");
    }
    else{
        urlLbl = document.getElementById("share_url_end");
    }
    
   // Select the text field 
    urlLbl.select();
    urlLbl.setSelectionRange(0, 99999); // For mobile devices

    // Copy the text inside the text field
    document.execCommand("copy");

    // Alert the copied text
    alert("Copied the text: " + urlLbl.value);
}
function drawChart(route) {
    
    let data = google.visualization.arrayToDataTable(route.elevations);
    // get highest & lowest elevation for chart scale
    let highestElevation = null;
    let lowestElevation = null;
    for(let i=1; i<route.elevations.length; i++){
        let e = route.elevations[i];
        if(highestElevation == null || e[1] > highestElevation){
            highestElevation = e[1];
        }
        if(lowestElevation == null || e[1] < lowestElevation){
            lowestElevation = e[1];
        }
    }
    // chart options
    let options = {
        curveType: 'function',
        legend: 'none',
        width:300,
        height:200,
        chartArea: {left:10,top:0, bottom:0,'width': '100%', 'height': '80%'},
        viewWindowMode:'explicit',
        viewWindow:{min:lowestElevation-10},
        vAxis: {
            title: 'Elevation',
            viewWindowMode : 'explicit',
            textPosition: 'in',
            viewWindow:{   
                    min: lowestElevation-10,
                    max: highestElevation+10
            }
        },
        hAxis: {
            textPosition: 'none'
        },
    };
    let chart = new google.visualization.LineChart(elevationContainer);
    chart.draw(data, options);
}

//error handling
function constructErrorMessage(message){
    return `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;
}
function throwPageError(message){
    clearErrors();
    errorContainer.innerHTML = constructErrorMessage(message);
    $("#error_toast").toast({
        delay: 3000
    });
    $("#error_toast").toast('show');
}
function clearErrors(){
    errorContainer.innerHTML = '';
}