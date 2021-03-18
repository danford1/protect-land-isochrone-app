// Weird errors when querying: 124 East Street, Doylestown, Pennsylvania 18901, United States
// sn {pt: f, message: "side location conflict [ (-75.02083181232753, 40.38035339790635, undefined) ]"}
// Ok Queries: 424 North Street
 
$(window).on('load', function(){
    renderSearchPrompt();
});


mapboxgl.accessToken = 'pk.eyJ1IjoiZGFuamZvcmQiLCJhIjoiY2p6d2x1ajlnMDhmZjNpbW04ODJldHdpeSJ9.V_fThN9k2-GaH--ULA-2ZA';

const DATA_SOURCES = {
    preservedLand: 'mapbox://danjford.blubsigi'
}

const APP = {
    isoParams: {
        urlBase: "https://api.mapbox.com/isochrone/v1/mapbox/",
        profile: "driving",
        minutes: "10",
    },
    searchPoint: [],
    isoFeature: {}
}

const MAP = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/danjford/ck086otr90fc11cojrwgzbb1d',
    center: [-75.133265, 40.325200],
    zoom: 11.5
});

const GEOCODER = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    placeholder: "Enter a Bucks County address",
    mapboxgl: mapboxgl,
    positionOptions: {enableHighAccuracy: true},
    trackUserLocation: false,
    marker: {'color': '#444'}
});

const MSG = document.getElementById('msg');

const clearIso = { type: 'FeatureCollection', features: [] }

document.getElementById('geocoder-container').appendChild(GEOCODER.onAdd(MAP));

// Map setup
MAP.on("load", function () {

    // Define map style layers to enable search
    let mapStyleLayers = MAP.getStyle().layers;
    // Find the index of the first symbol layer in the map style
    let firstSymbolId;
    for (let i = 0; i < mapStyleLayers.length; i++) {
        if (mapStyleLayers[i].type === 'symbol') {
            firstSymbolId = mapStyleLayers[i].id;
            break;
        }
    }

    MAP.addSource('preserved-land', {
        type: 'vector',
        url: DATA_SOURCES.preservedLand
    });
    MAP.addLayer({
        'id': 'preserved-land',
        'source': 'preserved-land',
        'source-layer': 'preservedland-b1u2ha',
        'type': 'fill',
        'layout': {
            'visibility': 'visible'
        },
        'paint': {
            'fill-color': '#57BC90',
            'fill-opacity': 0.5
        }
    }, firstSymbolId);

    MAP.addSource('iso', {
        type: 'geojson',
        data: {
            "type": 'FeatureCollection',
            "features": []
        }
    });

    MAP.addLayer({
        'id': 'isochrone',
        'type': 'fill',
        'source': 'iso',
        'layout': {},
        'paint': {
            'fill-color': '#7b3294',
            'fill-opacity': 0.4
        }
    }, firstSymbolId);

    MAP.addSource('intersection', {
        type: 'geojson',
        data: {
            "type": 'FeatureCollection',
            "features": []
        }
    });
    MAP.addLayer({
        'id': 'intersection-line',
        'type': 'line', // the line type requires polyline features, we are passing in polygons here so nothing shows https://docs.mapbox.com/mapbox-gl-js/style-spec/layers/#line
        'source': 'intersection',
        'paint': {
            'line-width': 4,
            'line-color': 'rgba(100,100,100, 0.8)'
        }
    }, 'preserved-land');
});

function getIsochroneURL(modality, time, long, lat) {
    let isoURL = "https://api.mapbox.com/isochrone/v1/mapbox/" +
        modality +
        "/" +
        long +
        "," +
        lat +
        "?contours_minutes=" +
        time +
        "&polygons=true" +
        "&access_token=" +
        mapboxgl.accessToken;

    return isoURL
}

// Render Application State 0: Prompt user to enter an address
function renderSearchPrompt() {
  //
  // const appState0 =
  // '<div class="grid container" id="container"> \
  //     <!-- App State 0 --> \
  //     <!-- Title --> \
  //     <div id="title" class="title"> \
  //         <h2>Enter an address</h2> \
  //     </div> \
  //     <!-- Title --> \
  //     <!-- Geocoder --> \
  //     <div id="geocoder-div" class="geocoder"> \
  //         <div id="geocoder-container" class="geocoder-container"></div> \
  //     </div> \
  //     <!-- Geocoder --> \
  //     <!-- Map --> \
  //     <div id="map"></div> \
  //     <!-- Map --> \
  //     <!-- Footer --> \
  //     <div id="footer" class="footer"> \
  //         <p>This is a footer area.</p> \
  //     </div> \
  //     <!-- Footer --> \
  //     <!-- App State 0 --> \
  // </div>';
  //
  // // Replace HTML with App State 0
  // $(".container").replaceWith($(appState0));

  document.getElementById('title').style.visibility = 'visible';
  document.getElementById('geocoder-div').style.visibility = 'visible';
  document.getElementById('geocoder-container').style.visibility = 'visible';
  document.getElementById('map').style.visibility = 'hidden';
  document.getElementById('footer').style.visibility = 'visible';

  searchAddress();

};

function searchAddress() {
    GEOCODER.on('result', function(ev) {
        let searchResult = ev.result.geometry;
        APP.searchPoint = searchResult;
        getIso();
    });
};

// Create a function that sets up the Isochrone API query then makes an Ajax call
function getIso() {
    APP.isoFeature = clearIso;

    let long = APP.searchPoint.coordinates[0];
    let lat = APP.searchPoint.coordinates[1];
    let isoURL = getIsochroneURL(APP.isoParams.profile, APP.isoParams.minutes, long, lat);

    fetch(isoURL)
        .then((response) => {
            return response.json();
        })
        .then((data) => {
            // Get the isochrone polygon
            APP.isoFeature = data.features[0];
            console.log("getIso APP.feature: ", APP.isoFeature);

            // Set the 'iso' source's data to what's returned by the API query
            MAP.getSource('iso').setData(data);

            // Zoom map frame to isochrone
            let bounds = turf.bbox(data);
            MAP.fitBounds(bounds, {duration: 0, padding: 40});

            getIntersection();
        });

};

function getIntersection() {

    // This could also be done with the TileQuery API
    let land = MAP.queryRenderedFeatures({layers: ['preserved-land']}); // Returns an array
    console.log("land: ", land);

    console.log(APP.isoFeature);


    let isoResult = turf.buffer(APP.isoFeature, 0.001);
    console.log("isoResult: ", isoResult);


    // ========================================
    // NEED TO FIGURE OUT HOW TO COUNT LAND FEATURES THAT INTERSECT ISOCHRONE
    // ========================================

    
    // let intersection = turf.intersect(land, isoResult); // errors because turf.intersect only works on features, not arrays of features, needs a loop
    // console.log(intersection);

    let intersection = land.reduce((collect, feature, i)=>{
        if (turf.intersect(feature, isoResult)){
            collect.push(feature)
        }
        return collect;
    }, []);
    console.log("intersected features", intersection);
    //
    //
    // // Populate the intersection map layer
    // This should be ok with an empty array also from above, if you want to skip the conditional
    let fc = turf.featureCollection(intersection);
    MAP.getSource("intersection").setData(fc);
    console.log("intersection source defined");
    // } else {
    //   MAP.getSource("intersection").setData({
    //     type: "FeatureCollection",
    //     features: []
    //   });
    //   console.log("intersection empty");
    // }

    renderResult(intersection.length);
};

function renderResult(count) {

    const footerResult =
    `<div id="map-footer" class="map-footer"> \
        <div class="result-block"> \
            <div class="result"> \
                <h1>${count ?? 0}</h1> \
            </div> \
            <div class="result-text"> \
                <p>protected properties are within a 10 minute drive</p> \
            </div> \
        </div> \
        <div class="message"> \
            <p>It takes a lot of work to maintain protected lands. Donate to help your local conservation nonprofit keep this land clean.</p> \
        </div> \
        <div class="donate-btn"> \
            <a href="./" class="btn btn-ghost">New address</a> \
            <a href="./" class="btn btn-green">Support conservation now</a> \
        </div> \
    </div>`;

    // Replace HTML with footer
    $(".footer").replaceWith($(footerResult));

    document.getElementById('title').style.visibility = 'hidden';
    document.getElementById('geocoder-div').style.visibility = 'hidden';
    document.getElementById('geocoder-container').style.visibility = 'hidden';
    document.getElementById('map').style.visibility = 'visible';
};
