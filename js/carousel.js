// carousel.js
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
        this.lastTime = 0;
        this.rotationSpeed = 0.055;
        this.isActive = false; // Track if this visualizer is currently visible
        this.activityFactor = 1.0; // Full activity by default
        this.setup();
    }

    setup() {
        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: window.innerWidth > 768,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setClearColor(0x404040);
        this.container.appendChild(this.renderer.domElement);

        this.camera = new THREE.PerspectiveCamera(40, this.container.clientWidth / this.container.clientHeight, 0.01, 1000);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableZoom = false;

        this.setupLights();
        this.setupPostProcessing();
        this.loadModel();

        // Set pixel ratio for better resolution on high-DPI screens
        this.renderer.setPixelRatio(window.devicePixelRatio);
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
        if(window.innerWidth < 768) {
            this.composer.setPixelRatio(window.devicePixelRatio*0.8);
        } else {
            this.composer.setPixelRatio(window.devicePixelRatio);
        }
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

                if (this.modelPath.includes("nausea")) {
                    this.modelGroup.position.y = 0; // Adjust this value as needed
                }

                if (this.modelPath.includes("tonka")) {
                    this.modelGroup.position.y = 0; // Adjust this value as needed
                }
            },
            (progress) => {
                console.log(`Loading ${this.modelPath}: ${(progress.loaded / progress.total * 100).toFixed(2)}%`);
            },
            (error) => {
                console.error(`Error loading ${this.modelPath}:`, error);
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
            `,
            precision: window.innerWidth <= 768 ? 'mediump' : 'highp'
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

    animate(currentTime) {
        if (!this.isActive) return; // Only animate if active
        
        // Convert time to seconds
        currentTime *= 0.001;

        // Calculate delta time
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        if (this.modelGroup) {
            // Calculate rotation based on fixed rotation speed and activity factor
            // This will make non-focused robots rotate slower
            const rotationAngle = this.rotationSpeed * Math.PI * 2 * deltaTime * this.activityFactor;
            this.modelGroup.rotation.z += rotationAngle;
        }

        this.controls.update();
        
        // Adjust outline pass intensity based on activity factor
        if (this.outlinePass && this.outlinePass.fsQuad && this.outlinePass.fsQuad.material) {
            // Adjust outline intensity based on activity
            const outlineColor = new THREE.Color(0xffffff);
            outlineColor.multiplyScalar(this.activityFactor);
            this.outlinePass.fsQuad.material.uniforms.outlineColor.value = outlineColor;
        }
        
        this.composer.render();
    }

    resize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.composer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.outlinePass.setSize(this.container.clientWidth, this.container.clientHeight);
        this.setCameraSettings();
    }

    // Set active state
    setActive(active, activityFactor = 1.0) {
        this.isActive = active;
        this.activityFactor = activityFactor;
        
        if (active) {
            // When activated, reset last time to current time to avoid jumps
            this.lastTime = performance.now() * 0.001;
            
            // Adjust model and rendering based on activity factor
            if (this.model) {
                // We can adjust model appearance based on activity level
                this.model.traverse((child) => {
                    if (child.isMesh && child.material) {
                        if (child.material.uniforms && child.material.uniforms.normalScale) {
                            // Adjust normal intensity for less focused items
                            child.material.uniforms.normalScale.value = 0.9 * this.activityFactor;
                        }
                    }
                });
            }
            
            // Render once to make sure the model is visible immediately
            if (this.composer) {
                this.composer.render();
            }
        }
    }
}

// Carousel Controller
class CarouselController {
    constructor() {
        this.carousel = document.getElementById('robot-carousel');
        this.prevButton = document.getElementById('prev-button');
        this.nextButton = document.getElementById('next-button');
        this.indicators = document.querySelectorAll('.indicator');
        
        this.currentIndex = 0;
        this.itemCount = document.querySelectorAll('.carousel-item').length;
        
        // Robot visualizers
        this.visualizers = [
            new RobotVisualizer('visualizer-1', '../gltfs/noogie-opt.glb'),
            new RobotVisualizer('visualizer-2', '../gltfs/lp-opt.glb'),
            new RobotVisualizer('visualizer-3', '../gltfs/nausea.glb'),
            new RobotVisualizer('visualizer-4', '../gltfs/tonka.glb')
        ];
        
        // Set the first visualizer as active
        this.visualizers[0].setActive(true);
        
        this.setupEventListeners();
        this.startAnimation();
        
        // Handle resize
        window.addEventListener('resize', () => this.handleResize());
    }
    
    setupEventListeners() {
        this.prevButton.addEventListener('click', () => this.navigate(-1));
        this.nextButton.addEventListener('click', () => this.navigate(1));
        
        // Setup indicators
        this.indicators.forEach((indicator, index) => {
            indicator.addEventListener('click', () => this.goToSlide(index));
        });
        
        // Optional: Touch swipe functionality
        let touchStartX = 0;
        let touchEndX = 0;
        
        this.carousel.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        });
        
        this.carousel.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            if (touchStartX - touchEndX > 50) {
                this.navigate(1); // Swipe left
            } else if (touchEndX - touchStartX > 50) {
                this.navigate(-1); // Swipe right
            }
        });
    }
    
    navigate(direction) {
        this.currentIndex = (this.currentIndex + direction + this.itemCount) % this.itemCount;
        this.updateCarousel();
    }
    
    goToSlide(index) {
        this.currentIndex = index;
        this.updateCarousel();
    }
    
    updateCarousel() {
        // We'll still move the carousel but with a different positioning approach
        const offset = this.currentIndex * 100;
        this.carousel.style.transform = `translateX(-${offset}%)`;
        
        // Update active class on carousel items
        const items = document.querySelectorAll('.carousel-item');
        items.forEach((item, index) => {
            item.classList.toggle('active', index === this.currentIndex);
        });
        
        // Update indicators
        this.indicators.forEach((indicator, index) => {
            indicator.classList.toggle('active', index === this.currentIndex);
        });
        
        // Activate current visualizer, deactivate others
        this.visualizers.forEach((visualizer, index) => {
            // Keep adjacent visualizers semi-active for better performance
            // The main one is fully active, adjacent ones are at reduced activity
            if (index === this.currentIndex) {
                visualizer.setActive(true);
            } else if (Math.abs(index - this.currentIndex) === 1) {
                // Adjacent visualizers are semi-active (visible but not animating at full rate)
                visualizer.setActive(true, 0.3); // Pass a reduced animation factor
            } else {
                visualizer.setActive(false);
            }
        });
    }
    
    startAnimation() {
        const animate = (time) => {
            requestAnimationFrame(animate);
            
            // Animate only the active visualizer
            this.visualizers.forEach(visualizer => {
                visualizer.animate(time);
            });
        };
        
        requestAnimationFrame(animate);
    }
    
    handleResize() {
        this.visualizers.forEach(visualizer => {
            visualizer.resize();
        });
    }
}

// Initialize the carousel when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const carousel = new CarouselController();
});