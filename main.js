// main.js

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
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x404040);
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(0, 1, 0);
scene.add(directionalLight);

const controls = new OrbitControls(camera, renderer.domElement);

console.log('Scene, camera, renderer, and lights set up successfully');


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
    './lp.gltf', 
    (gltf) => {
        console.log('GLTF model loaded successfully');
        const model = gltf.scene;

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

        // Center the model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        model.position.sub(center);

        // Rotate the model to face the camera
        model.rotation.x = -Math.PI / 2;

        // Adjust camera position based on model size
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        cameraZ *= 1.5;

        camera.position.set(0, 0, cameraZ);

        // Update the orbit controls
        controls.target.set(0, 0, 0);
        controls.update();

        // Add the model to the outline pass
        outlinePass.selectedObjects = [model];

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
    controls.update();
    composer.render();
}
animate();

window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    edgePass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
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