import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { CustomOutlinePass } from './CustomOutlinePass.js';
import FindSurfaces from './FindSurfaces.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

console.log('THREE.js version:', THREE.REVISION);
console.log('GLTFLoader imported successfully');

const scene = new THREE.Scene();

let model; // global model
let modelGroup;

const container = document.getElementById('visualizer');
const renderer = new THREE.WebGLRenderer();

renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setClearColor(0x404040);
container.appendChild(renderer.domElement);
// document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(40, container.clientWidth  / window.clientHeight, 0.01, 1000);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(0, 1, 0);
scene.add(directionalLight);

const controls = new OrbitControls(camera, renderer.domElement);
//controls.enablePan = false; // Disable panning
controls.enableZoom = false;

console.log('Scene, camera, renderer, and lights set up successfully');

// Function to check if the device is mobile
function isMobile() {
    return window.innerWidth <= 768; // Adjust this threshold as needed
}

// Function to set camera position and rotation
function setCameraSettings() {
    if (isMobile()) {
        controls.enableRotate = false; // lock rotation of model on mobile
        camera.position.set(0.03, 0.20, 0.41);
        camera.rotation.set(-0.46, 0.08, 0.04);
    } else {
        controls.enableRotate = true; // allow rotation for desktop devices
        camera.position.set(0.03, 0.14, 0.37);
        camera.rotation.set(-0.46, 0.08, 0.04);
    }
    controls.target.set(0, 0, 0);
    controls.update();
}


// Custom shader material for blueprint effect
const modelMaterial = new THREE.ShaderMaterial({
    uniforms: {
        baseColor: { value: new THREE.Color(0xb0b0b0) },
        normalScale: { value: 0.9 }
    },
    vertexShader: `
        varying vec3 vNormal;
        void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform vec3 baseColor;
        uniform float normalScale;
        varying vec3 vNormal;
        void main() {
            float normalValue = (dot(vNormal, vec3(0, 0, 1)) * 0.5 + 0.5) * normalScale;
            gl_FragColor = vec4(baseColor, 1.0) * (0.5 + normalValue);
        }
    `
});

// Set up EffectComposer
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// Create OutlinePass for silhouette
const outlinePass = new CustomOutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
composer.addPass(outlinePass);

const surfaceFinder = new FindSurfaces();

// add surfaces to mesh
function addSurfaceIdAttributeToMesh(scene) {
    surfaceFinder.surfaceId = 0;
  
    scene.traverse((node) => {
      if (node.type == "Mesh") {
        const colorsTypedArray = surfaceFinder.getSurfaceIdAttribute(node);
        node.geometry.setAttribute(
          "color",
          new THREE.BufferAttribute(colorsTypedArray, 4)
        );
      }
    });
  
    outlinePass.updateMaxSurfaceId(surfaceFinder.surfaceId + 1);
  }


const loader = new GLTFLoader();
console.log('Attempting to load GLTF file: ./lp.gltf');

loader.load(
    './nausea.glb', 
    (gltf) => {

        // update camera before drawing to display initially in the container
        renderer.setSize(container.clientWidth, container.clientHeight);
        composer.setSize(container.clientWidth, container.clientHeight);
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();

        console.log('GLTF model loaded successfully');
        model = gltf.scene;

        // Apply matte color for written effect
        model.traverse((child) => {
            if (child.isMesh) {
                child.material = modelMaterial;
            }
        });
        scene.add(model);

        // apply surface ids to meshes
        addSurfaceIdAttributeToMesh(model);
        console.log('GLTF model added to scene');


        // Create a new Group to hold the centered model (for animations)
        modelGroup = new THREE.Group();
        scene.add(modelGroup);

        // Center the model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        model.position.sub(center);

        // Add the centered model to the group
        modelGroup.add(model);

        modelGroup.position.y = 0.03;

        // Rotate the model to face the camera
        modelGroup.rotation.x = -Math.PI / 2;


        // // Adjust camera position based on model size
        // const maxDim = Math.max(size.x, size.y, size.z);
        // const fov = camera.fov * (Math.PI / 180);
        // let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        // cameraZ *= 1.5;

        //camera.position.set(0, 0, cameraZ);


        // Set camera position based on provided values
        camera.position.set(0.05, 0.29, 0.58);
        camera.rotation.set(-0.46, 0.07, 0.04);

        //camera.lookAt(new THREE.Vector3(-0.52, 0.02, 0.01));
        
        //controls.target.set(-0.52, 0.02, 0.01);

        // Update the orbit controls
        controls.target.set(0, 0, 0);
        controls.update();

        // Add the model to the outline pass
        outlinePass.selectedObjects = [model];

        setCameraSettings();

        composer.render();
    },
    (progress) => {
        console.log('Loading progress:', (progress.loaded / progress.total * 100).toFixed(2) + '%');
    },
    (error) => {
        console.error('An error occurred while loading the GLTF model:', error);
        console.error('Error details:', error.message);
        if (error.stack) {
            console.error('Error stack:', error.stack);
        }
    }
);

function animate() {
    requestAnimationFrame(animate);


    // roate bot
    if (modelGroup) {
        modelGroup.rotation.z += 0.005;
    }

    controls.update();
    composer.render();
}
animate();

// Camera debug
function logCameraInfo() {
    console.log('Camera position:', 
        camera.position.x.toFixed(2),
        camera.position.y.toFixed(2),
        camera.position.z.toFixed(2)
    );
    console.log('Camera rotation (in radians):', 
        camera.rotation.x.toFixed(2),
        camera.rotation.y.toFixed(2),
        camera.rotation.z.toFixed(2)
    );
    console.log('OrbitControls target:', 
        controls.target.x.toFixed(2),
        controls.target.y.toFixed(2),
        controls.target.z.toFixed(2)
    );
}


// camera debug on keypress
window.addEventListener('keydown', (event) => {
    if (event.key === 'c' || event.key === 'C') {
        logCameraInfo();
    }
});

window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
    composer.setSize(container.clientWidth, container.clientHeight);
    outlinePass.setSize(container.clientWidth, container.clientHeight);

    setCameraSettings();
}

console.log('Animation loop started');
console.log('Script execution completed');

window.addEventListener('error', function(event) {
    console.error('Global error caught:', event.message);
    console.error('Error source:', event.filename, 'Line:', event.lineno, 'Column:', event.colno);
    if (event.error && event.error.stack) {
        console.error('Error stack:', event.error.stack);
    }
});