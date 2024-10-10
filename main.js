// main.js

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { CustomOutlinePass } from './CustomOutlinePass.js';
import FindSurfaces from './FindSurfaces.js';

class RobotVisualizer {
    constructor(containerId, modelPath) {
        this.container = document.getElementById(containerId);
        this.modelPath = modelPath;
        this.setup();
    }

    setup() {
        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setClearColor(0x404040);
        this.container.appendChild(this.renderer.domElement);

        this.camera = new THREE.PerspectiveCamera(40, this.container.clientWidth / this.container.clientHeight, 0.01, 1000);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableZoom = false;

        this.setupLights();
        this.setupPostProcessing();
        this.loadModel();

        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(0, 1, 0);
        this.scene.add(directionalLight);
    }

    setupPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        this.outlinePass = new CustomOutlinePass(new THREE.Vector2(this.container.clientWidth, this.container.clientHeight), this.scene, this.camera);
        this.composer.addPass(this.outlinePass);
    }

    loadModel() {
        const loader = new GLTFLoader();
        loader.load(
            this.modelPath,
            (gltf) => {
                this.model = gltf.scene;
                this.applyMaterial();
                this.scene.add(this.model);
                this.addSurfaceIdAttributeToMesh();
                this.centerModel();
                this.setCameraSettings();
                this.outlinePass.selectedObjects = [this.model];
                this.composer.render();
            },
            (progress) => {
                console.log('Loading progress:', (progress.loaded / progress.total * 100).toFixed(2) + '%');
            },
            (error) => {
                console.error('An error occurred while loading the GLTF model:', error);
            }
        );
    }

    applyMaterial() {
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

        this.model.traverse((child) => {
            if (child.isMesh) {
                child.material = modelMaterial;
            }
        });
    }

    addSurfaceIdAttributeToMesh() {
        const surfaceFinder = new FindSurfaces();
        surfaceFinder.surfaceId = 0;

        this.model.traverse((node) => {
            if (node.type == "Mesh") {
                const colorsTypedArray = surfaceFinder.getSurfaceIdAttribute(node);
                node.geometry.setAttribute(
                    "color",
                    new THREE.BufferAttribute(colorsTypedArray, 4)
                );
            }
        });

        this.outlinePass.updateMaxSurfaceId(surfaceFinder.surfaceId + 1);
    }

    centerModel() {
        this.modelGroup = new THREE.Group();
        this.scene.add(this.modelGroup);

        const box = new THREE.Box3().setFromObject(this.model);
        const center = box.getCenter(new THREE.Vector3());

        this.model.position.sub(center);
        this.modelGroup.add(this.model);
        this.modelGroup.position.y = 0.03;
        this.modelGroup.rotation.x = -Math.PI / 2;
    }

    // set camera settings for mobile & desktop devices
    setCameraSettings() {
        if (window.innerWidth <= 768) {
            this.controls.enableRotate = false;
            this.camera.position.set(0.03, 0.20, 0.29);
            this.camera.rotation.set(-0.46, 0.08, 0.04);
        } else {
            this.controls.enableRotate = true;
            this.camera.position.set(0.03, 0.14, 0.37);
            this.camera.rotation.set(-0.46, 0.08, 0.04);
        }
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        if (this.modelGroup) {
            this.modelGroup.rotation.z += 0.002;
        }
        this.controls.update();
        this.composer.render();
    }

    onWindowResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.composer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.outlinePass.setSize(this.container.clientWidth, this.container.clientHeight);
        this.setCameraSettings();
    }
}

// Create instances for each  (optimized versions using https://glb.babylonpress.org/)
const noogiesVisualizer = new RobotVisualizer('visualizer', './noogie-opt.glb');
const lunchpadVisualizer = new RobotVisualizer('visualizer2', './lp-opt.glb');

// Start animation loops
noogiesVisualizer.animate();
lunchpadVisualizer.animate();