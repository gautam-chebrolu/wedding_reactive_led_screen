import { MoonScene, moonMetadata } from './moon.js';
import { PortraitScene, portraitMetadata } from './portrait.js';
import { CameraScene, cameraMetadata } from './camera-remix.js';
import { BallScene, ballMetadata } from './ball.js';
import { KaleidoscopeScene, kaleidoscopeMetadata } from './kaleidoscope.js';
import { MonogramScene, monogramMetadata } from './monogram.js';
import { DVDScene, dvdMetadata } from './dvd.js';
import { PGCameraScene, pgCameraMetadata } from './pg-camera.js';
import { ChapelScene, chapelMetadata } from './chapel.js';
import { MemoriesScene, memoriesMetadata } from './memories.js';
import { RangoliScene, rangoliMetadata } from './rangoli.js';
import { MehndiScene, mehndiMetadata } from './mehndi.js';
import { BaraatScene, baraatMetadata } from './baraat.js';
import { KelloggScene, kelloggMetadata } from './kellogg.js';
import { HyperspaceScene, hyperspaceMetadata } from './hyperspace.js';
import { LiquidScene, liquidMetadata } from './liquid.js';
import { TunakScene, tunakMetadata } from './tunak.js';
import { CoupleScene, coupleMetadata } from './couple.js';

// Add a scene here. It receives the exact same audio, camera and settings frame.
export const sceneRegistry = [
  { ...moonMetadata, create: () => new MoonScene() },
  { ...portraitMetadata, create: () => new PortraitScene() },
  { ...cameraMetadata, create: () => new CameraScene() },
  { ...ballMetadata, create: () => new BallScene() },
  { ...kaleidoscopeMetadata, create: () => new KaleidoscopeScene() },
  { ...monogramMetadata, create: () => new MonogramScene() },
  { ...dvdMetadata, create: () => new DVDScene() },
  { ...pgCameraMetadata, create: () => new PGCameraScene() },
  { ...chapelMetadata, create: () => new ChapelScene() },
  { ...memoriesMetadata, create: () => new MemoriesScene() },
  { ...rangoliMetadata, create: () => new RangoliScene() },
  { ...mehndiMetadata, create: () => new MehndiScene() },
  { ...baraatMetadata, create: () => new BaraatScene() },
  { ...kelloggMetadata, create: () => new KelloggScene() },
  { ...hyperspaceMetadata, create: () => new HyperspaceScene() },
  { ...liquidMetadata, create: () => new LiquidScene() },
  { ...tunakMetadata, create: () => new TunakScene() },
  { ...coupleMetadata, create: () => new CoupleScene() }
];
