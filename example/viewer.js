import {
	DebugTilesRenderer as TilesRenderer,
	NONE,
	SCREEN_ERROR,
	GEOMETRIC_ERROR,
	DISTANCE,
	DEPTH,
	RELATIVE_DEPTH,
	IS_LEAF,
	RANDOM_COLOR,
} from '../src/index.js';
import {
	Scene,
	DirectionalLight,
	AmbientLight,
	WebGLRenderer,
	PerspectiveCamera,
	CameraHelper,
	Box3,
	Raycaster,
	Vector2,
	Mesh,
	CylinderBufferGeometry,
	MeshBasicMaterial,
	Group,
	TorusBufferGeometry,
	sRGBEncoding,
	MeshLambertMaterial,
	TextureLoader,
	LinearFilter,
	PlaneBufferGeometry
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as dat from 'three/examples/jsm/libs/dat.gui.module.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';

const ALL_HITS = 1;
const FIRST_HIT_ONLY = 2;

const RENDER_LOOP = false;

let LOOPS = 10;

let camera, controls, scene, renderer, tiles, cameraHelper;
let box;
let raycaster, mouse, rayIntersect, lastHoveredElement;
let offsetParent;
let statsContainer, stats;
let material;
let diffuseMap;

let active_tiles = [];

let params = {

	'enableUpdate': true,
	'raycast': NONE,
	'enableCacheDisplay': false,

	'errorTarget': 20,
	'errorThreshold': 60,
	'maxDepth': 15,
	'loadSiblings': false,
	'displayActiveTiles': false,
	'resolutionScale': 1.0,

	'up': '+Z',
	'displayBoxBounds': false,
	'colorMode': 0,
	'showThirdPerson': false,
	'showSecondView': false,

	'materialColor': "#ffffff",
	'backgroundColor': "#254a64",

	'maxTiles': 200,

	'reload': reinstantiateTiles,
	'render': animate,

};

init();
animate();

function addLoop() {

	if ( RENDER_LOOP ) {

		return;

	}

	LOOPS ++;

	if ( LOOPS == 1 ) {

		animate();

	}

}

function reinstantiateTiles() {

	const url = window.location.hash.replace( /^#/, '' ) || '../data/zuidholland/tileset1.json';

	if ( tiles ) {

		offsetParent.remove( tiles.group );

	}

	tiles = new TilesRenderer( url );
	tiles.downloadQueue.priorityCallback = tile => 1 / tile.cached.distance;
	offsetParent.add( tiles.group );

	tiles.onLoadModel = ( s ) => {

		s.traverse( c => {

			if ( c.material ) {

				c.material = material;

			}

		} );

		addLoop();

	};

}

function init() {

	scene = new Scene();

	material = new MeshLambertMaterial();

	// primary camera view
	renderer = new WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setClearColor( 0xd9eefc );
	renderer.outputEncoding = sRGBEncoding;

	document.body.appendChild( renderer.domElement );

	camera = new PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, 40000 );
	camera.position.set( 400, 400, 400 );
	// camera.lookAt( - 22111.060710441925, 0, - 2634.3124026883734 );
	cameraHelper = new CameraHelper( camera );
	scene.add( cameraHelper );

	// controls
	controls = new OrbitControls( camera, renderer.domElement );
	controls.screenSpacePanning = false;
	controls.minDistance = 1;
	controls.maxDistance = 10000;
	controls.addEventListener( "change", addLoop );

	// lights
	const dirLight = new DirectionalLight( 0xffffff );
	dirLight.position.set( 1, 2, 3 );
	scene.add( dirLight );

	const ambLight = new AmbientLight( 0xffffff, 0.2 );
	scene.add( ambLight );

	box = new Box3();

	offsetParent = new Group();
	scene.add( offsetParent );

	// Raycasting init
	raycaster = new Raycaster();
	mouse = new Vector2();

	rayIntersect = new Group();

	const rayIntersectMat = new MeshBasicMaterial( { color: 0xe91e63 } );
	const rayMesh = new Mesh( new CylinderBufferGeometry( 0.25, 0.25, 6 ), rayIntersectMat );
	rayMesh.rotation.x = Math.PI / 2;
	rayMesh.position.z += 3;
	rayIntersect.add( rayMesh );

	const rayRing = new Mesh( new TorusBufferGeometry( 1.5, 0.2, 16, 100 ), rayIntersectMat );
	rayIntersect.add( rayRing );
	scene.add( rayIntersect );
	rayIntersect.visible = false;

	reinstantiateTiles();

	onWindowResize();
	window.addEventListener( 'resize', onWindowResize, false );
	renderer.domElement.addEventListener( 'mousemove', onMouseMove, false );
	renderer.domElement.addEventListener( 'mousedown', onMouseDown, false );
	renderer.domElement.addEventListener( 'mouseup', onMouseUp, false );
	renderer.domElement.addEventListener( 'mouseleave', onMouseLeave, false );

	// GUI
	const gui = new dat.GUI();
	gui.width = 300;

	const tileOptions = gui.addFolder( 'Tiles Options' );
	tileOptions.add( params, 'loadSiblings' );
	tileOptions.add( params, 'displayActiveTiles' );
	tileOptions.add( params, 'errorTarget' ).min( 0 ).max( 1000 ).onChange( addLoop );
	tileOptions.add( params, 'errorThreshold' ).min( 0 ).max( 1000 ).onChange( addLoop );
	tileOptions.add( params, 'maxDepth' ).min( 1 ).max( 100 );
	tileOptions.add( params, 'up', [ '+Y', '-Z', '+Z' ] );
	tileOptions.add( params, 'maxTiles' ).min( 0 ).max( 500 ).onChange( addLoop );
	tileOptions.open();

	const debug = gui.addFolder( 'Debug Options' );
	debug.add( params, 'displayBoxBounds' ).onChange( addLoop );
	debug.add( params, 'colorMode', {

		NONE,
		SCREEN_ERROR,
		GEOMETRIC_ERROR,
		DISTANCE,
		DEPTH,
		RELATIVE_DEPTH,
		IS_LEAF,
		RANDOM_COLOR,

	} ).onChange( addLoop );
	debug.open();

	const exampleOptions = gui.addFolder( 'Example Options' );
	exampleOptions.add( params, 'resolutionScale' ).min( 0.01 ).max( 2.0 ).step( 0.01 ).onChange( onWindowResize );
	exampleOptions.add( params, 'enableUpdate' ).onChange( v => {

		tiles.parseQueue.autoUpdate = v;
		tiles.downloadQueue.autoUpdate = v;

		if ( v ) {

			tiles.parseQueue.scheduleJobRun();
			tiles.downloadQueue.scheduleJobRun();

		}

	} );
	exampleOptions.add( params, 'raycast', { NONE, ALL_HITS, FIRST_HIT_ONLY } );
	exampleOptions.add( params, 'enableCacheDisplay' );
	exampleOptions.close();

	const colorOptions = gui.addFolder( 'Colors' );
	colorOptions.addColor( params, 'materialColor' ).onChange( addLoop );
	colorOptions.addColor( params, 'backgroundColor' ).onChange( addLoop );

	gui.add( params, 'reload' );
	gui.add( params, 'render' );
	gui.open();

	statsContainer = document.createElement( 'div' );
	statsContainer.style.position = 'absolute';
	statsContainer.style.top = 0;
	statsContainer.style.left = 0;
	statsContainer.style.color = 'white';
	statsContainer.style.width = '100%';
	statsContainer.style.textAlign = 'center';
	statsContainer.style.padding = '5px';
	statsContainer.style.pointerEvents = 'none';
	statsContainer.style.lineHeight = '1.5em';
	document.body.appendChild( statsContainer );

	// Stats
	stats = new Stats();
	stats.showPanel( 0 );
	document.body.appendChild( stats.dom );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	renderer.setSize( window.innerWidth, window.innerHeight );

	camera.updateProjectionMatrix();
	renderer.setPixelRatio( window.devicePixelRatio * params.resolutionScale );

}

function onMouseLeave( e ) {

	lastHoveredElement = null;

}

function onMouseMove( e ) {

	const bounds = this.getBoundingClientRect();
	mouse.x = e.clientX - bounds.x;
	mouse.y = e.clientY - bounds.y;
	mouse.x = ( mouse.x / bounds.width ) * 2 - 1;
	mouse.y = - ( mouse.y / bounds.height ) * 2 + 1;

	lastHoveredElement = this;

}

const startPos = new Vector2();
const endPos = new Vector2();
function onMouseDown( e ) {

	const bounds = this.getBoundingClientRect();
	startPos.set( e.clientX - bounds.x, e.clientY - bounds.y );

}

function onMouseUp( e ) {

	const bounds = this.getBoundingClientRect();
	endPos.set( e.clientX - bounds.x, e.clientY - bounds.y );
	if ( startPos.distanceTo( endPos ) > 2 ) {

		return;

	}

	raycaster.setFromCamera( mouse, camera );

	raycaster.firstHitOnly = true;
	const results = raycaster.intersectObject( tiles.group, true );
	if ( results.length ) {

		const object = results[ 0 ].object;
		const info = tiles.getTileInformationFromActiveObject( object );

		const idx = results[ 0 ].face.a;
		const b_offset = object.geometry.attributes._batchid.offset;
		const stride = object.geometry.attributes._batchid.data.stride;
		const batch_id = object.geometry.attributes._batchid.data.array[ b_offset + stride * idx ];

		console.log( `Batch ID: ${ batch_id }` );

		if ( 'identificatie' in object.parent.batchAttributes ) {

			const identificatie = object.parent.batchAttributes.identificatie[ batch_id ];
			console.log( `Identificatie: ${ identificatie }` );

		}

		let str = '';
		for ( const key in info ) {

			let val = info[ key ];
			if ( typeof val === 'number' ) {

				val = Math.floor( val * 1e5 ) / 1e5;

			}

			let name = key;
			while ( name.length < 20 ) {

				name += ' ';

			}

			str += `${ name } : ${ val }\n`;

		}
		console.log( str );

	}

}

function animate() {

	if ( LOOPS > 0 || RENDER_LOOP ) {

		LOOPS --;
		requestAnimationFrame( animate );

	}

	// update options
	tiles.errorTarget = params.errorTarget;
	tiles.errorThreshold = params.errorThreshold;
	tiles.loadSiblings = params.loadSiblings;
	tiles.displayActiveTiles = params.displayActiveTiles;
	tiles.maxDepth = params.maxDepth;
	tiles.displayBoxBounds = params.displayBoxBounds;
	tiles.colorMode = parseFloat( params.colorMode );

	material.color.setHex( params.materialColor.replace( "#", "0x" ) );
	renderer.setClearColor( parseInt( params.backgroundColor.replace( "#", "0x" ) ) );

	tiles.setCamera( camera );
	tiles.setResolutionFromRenderer( camera, renderer );

	offsetParent.rotation.set( 0, 0, 0 );
	if ( params.up === '-Z' ) {

		offsetParent.rotation.x = Math.PI / 2;

	} else if ( params.up === '+Z' ) {

		offsetParent.rotation.x = - Math.PI / 2;

	}
	offsetParent.updateMatrixWorld( true );

	// update tiles center
	if ( tiles.getBounds( box ) ) {

		box.getCenter( tiles.group.position );
		tiles.group.position.multiplyScalar( - 1 );

	}

	if ( parseFloat( params.raycast ) !== NONE && lastHoveredElement !== null ) {

		raycaster.setFromCamera( mouse, camera );

		raycaster.firstHitOnly = parseFloat( params.raycast ) === FIRST_HIT_ONLY;

		const results = raycaster.intersectObject( tiles.group, true );
		if ( results.length ) {

			const closestHit = results[ 0 ];
			const point = closestHit.point;
			rayIntersect.position.copy( point );

			// If the display bounds are visible they get intersected
			if ( closestHit.face ) {

				const normal = closestHit.face.normal;
				normal.transformDirection( closestHit.object.matrixWorld );
				rayIntersect.lookAt(
					point.x + normal.x,
					point.y + normal.y,
					point.z + normal.z
				);

			}

			rayIntersect.visible = true;

		} else {

			rayIntersect.visible = false;

		}

	} else {

		rayIntersect.visible = false;

	}

	// update tiles
	window.tiles = tiles;
	if ( params.enableUpdate ) {

		camera.updateMatrixWorld();
		tiles.update();
		updatewms();

	}

	render();
	stats.update();

}

function updatewms() {

	if ( tiles.root ) {

		for ( let i = 0; i < tiles.root.children.length; i ++ ) {

			let child = tiles.root.children[ i ].children[ 0 ];
			if ( child.__visible && ! active_tiles.some( e => e == i ) && active_tiles.length < params.maxTiles ) {

				active_tiles.push( i );
				let x = child.cached.boxTransform.elements[ 12 ];
				let y = child.cached.boxTransform.elements[ 13 ];

				let real_x = child.boundingVolume.box[ 0 ];
				let real_y = child.boundingVolume.box[ 1 ];

				let width = child.cached.box.max.x - child.cached.box.min.x;
				let height = child.cached.box.max.y - child.cached.box.min.y;
				create_tile( "https://geodata.nationaalgeoregister.nl/luchtfoto/rgb/wmts?", "2016_ortho25", "image/png", "default", x, y, real_x, real_y, width, height, 0.256 );

			}

		}

	}

}

function create_tile( url, layer, format, style, x, y, real_x, real_y, mesh_width, mesh_height, ppm ) {

	// https://geodata.nationaalgeoregister.nl/luchtfoto/rgb/wmts?request=GetMap&service=wms&version=1.3.0&layers=2016_ortho25&width=256&height=256&crs=EPSG:28992&bbox=112409,399765,112664,399926&format=image/jpeg&styles=default
	let request_url = url;
	request_url += "request=GetMap&service=wms&version=1.3.0";
	request_url += `&layers=${ layer }`;
	request_url += `&format=${ format }`;
	request_url += `&styles=${ style }`;
	request_url += `&width=${ mesh_width * ppm }&height=${ mesh_height * ppm }`;
	request_url += `&crs=EPSG:28992`;
	request_url += `&bbox=${ x - mesh_width / 2 },${ y - mesh_height / 2 },${ x + mesh_width / 2 },${ y + mesh_height / 2 }`;

	var loader = new TextureLoader();

	diffuseMap = loader.load( request_url, animate );
	diffuseMap.minFilter = LinearFilter;
	diffuseMap.generateMipmaps = false;

	var geometry = new PlaneBufferGeometry( mesh_width, mesh_height );
	var material = new MeshBasicMaterial( { map: diffuseMap } );

	var mesh = new Mesh( geometry, material );
	offsetParent.add( mesh );

	mesh.position.x = real_x;
	mesh.position.y = real_y;
	mesh.updateMatrix();

}

function render() {

	cameraHelper.visible = false;

	// render primary view
	const dist = camera.position.distanceTo( rayIntersect.position );
	rayIntersect.scale.setScalar( dist * camera.fov / 6000 );
	renderer.render( scene, camera );

	const cacheFullness = tiles.lruCache.itemList.length / tiles.lruCache.minSize;
	let str = `Downloading: ${ tiles.stats.downloading } Parsing: ${ tiles.stats.parsing } Visible: ${ tiles.group.children.length - 2 }`;

	if ( params.enableCacheDisplay ) {

		const geomSet = new Set();
		tiles.traverse( tile => {

			const scene = tile.cached.scene;
			if ( scene ) {

				scene.traverse( c => {

					if ( c.geometry ) {

						geomSet.add( c.geometry );

					}

				} );

			}

		} );

		let count = 0;
		geomSet.forEach( g => {

			count += BufferGeometryUtils.estimateBytesUsed( g );

		} );
		str += `<br/>Cache: ${ ( 100 * cacheFullness ).toFixed( 2 ) }% ~${ ( count / 1000 / 1000 ).toFixed( 2 ) }mb`;

	}

	if ( statsContainer.innerHTML !== str ) {

		statsContainer.innerHTML = str;

	}

}
