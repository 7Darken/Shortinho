#!/usr/bin/env node

/**
 * Script de test pour vérifier la détection des plateformes
 * Usage: node test-platforms.js
 */

import { detectPlatform, getSupportedPlatforms, isSupported } from './services/platforms/PlatformFactory.js';

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║        TEST DE DÉTECTION DES PLATEFORMES                  ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// URLs de test
const testUrls = [
  // TikTok
  { url: 'https://www.tiktok.com/@user/video/1234567890', expected: 'TikTok' },
  { url: 'https://tiktok.com/@chef/video/9876543210', expected: 'TikTok' },
  { url: 'https://vm.tiktok.com/ZMabcdef/', expected: 'TikTok' },

  // YouTube Shorts (UNIQUEMENT les Shorts, pas les vidéos normales)
  { url: 'https://www.youtube.com/shorts/dQw4w9WgXcQ', expected: 'YouTube' },
  { url: 'https://youtube.com/shorts/abc123', expected: 'YouTube' },

  // Instagram
  { url: 'https://www.instagram.com/reel/ABC123/', expected: 'Instagram' },
  { url: 'https://instagram.com/p/DEF456/', expected: 'Instagram' },

  // URLs non supportées (y compris vidéos YouTube normales)
  { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', expected: null },
  { url: 'https://youtu.be/dQw4w9WgXcQ', expected: null },
  { url: 'https://facebook.com/watch/123', expected: null },
  { url: 'https://twitter.com/user/status/123', expected: null },
];

console.log('📋 Plateformes supportées:');
const platforms = getSupportedPlatforms();
platforms.forEach((platform, idx) => {
  console.log(`   ${idx + 1}. ${platform.name} - Pattern: ${platform.pattern}`);
});
console.log('');

console.log('🧪 Tests de détection:\n');

let passed = 0;
let failed = 0;

testUrls.forEach((test, idx) => {
  try {
    const platform = detectPlatform(test.url);
    const success = platform.name === test.expected;

    if (success) {
      console.log(`✅ Test ${idx + 1}: ${platform.name} détecté`);
      console.log(`   URL: ${test.url}`);
      passed++;
    } else {
      console.log(`❌ Test ${idx + 1}: Attendu ${test.expected}, reçu ${platform.name}`);
      console.log(`   URL: ${test.url}`);
      failed++;
    }
  } catch (error) {
    if (test.expected === null) {
      console.log(`✅ Test ${idx + 1}: Plateforme non supportée (attendu)`);
      console.log(`   URL: ${test.url}`);
      passed++;
    } else {
      console.log(`❌ Test ${idx + 1}: Erreur inattendue`);
      console.log(`   URL: ${test.url}`);
      console.log(`   Erreur: ${error.message}`);
      failed++;
    }
  }
  console.log('');
});

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║                   RÉSULTAT DES TESTS                       ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');
console.log(`✅ Réussis: ${passed}/${testUrls.length}`);
console.log(`❌ Échoués: ${failed}/${testUrls.length}`);

if (failed === 0) {
  console.log('\n🎉 Tous les tests sont passés avec succès!');
  process.exit(0);
} else {
  console.log('\n⚠️  Certains tests ont échoué');
  process.exit(1);
}
