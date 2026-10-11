import {NATIVE_ASSETS} from "./native-assets.js";
// Original 18 IDs and six transaction slots; no prices, ownership, or data conversion.
export const NATIVE_ITEMS=Object.freeze([
  {
    "id": "oak-wand",
    "name": "入門木劍",
    "slot": "weapon",
    "src": "/wood-sword-native-v1.png",
    "width": 1024,
    "height": 1536,
    "grip": [
      512,
      1180
    ],
    "length": 155,
    "gripToTip": 1105
  },
  {
    "id": "star-wand",
    "name": "星光法杖",
    "slot": "weapon",
    "src": "/star-wand-native-v4.png",
    "width": 1024,
    "height": 1536,
    "atlas": false,
    "grip": [
      512,
      1250
    ],
    "length": 185,
    "gripToTip": 1206
  },
  {
    "id": "moon-sword",
    "name": "月牙短劍",
    "slot": "weapon",
    "src": "/moon-sword-native-v4.png",
    "width": 1024,
    "height": 1536,
    "grip": [
      512,
      1180
    ],
    "length": 165,
    "gripToTip": 1130
  },
  {
    "id": "sun-wand",
    "name": "晨曦法杖",
    "slot": "weapon",
    "src": "/sun-wand-native-v4.png",
    "width": 1024,
    "height": 1536,
    "atlas": false,
    "grip": [
      512,
      1250
    ],
    "length": 185,
    "gripToTip": 1216
  },
  {
    "id": "leaf-shield",
    "name": "嫩葉盾牌",
    "slot": "shield",
    "src": "/leaf-shield-native-v4.png",
    "width": 1254,
    "height": 1254,
    "grip": [
      660,
      750
    ],
    "scale": 0.14
  },
  {
    "id": "star-shield",
    "name": "星紋盾牌",
    "slot": "shield",
    "src": "/star-shield-native-v4.png",
    "width": 1254,
    "height": 1254,
    "atlas": false,
    "grip": [
      677,
      740
    ],
    "scale": 0.105
  },
  {
    "id": "traveler-hat",
    "name": "旅人帽",
    "slot": "head",
    "src": "/traveler-hat-native-v4.png",
    "width": 1254,
    "height": 1254,
    "atlas": false,
    "grip": [
      690,
      850
    ],
    "scale": 0.128
  },
  {
    "id": "wizard-hat",
    "name": "星夜巫師帽",
    "slot": "head",
    "src": "/wizard-hat-native-v4.png",
    "width": 1254,
    "height": 1254,
    "atlas": false,
    "grip": [
      760,
      930
    ],
    "scale": 0.125
  },
  {
    "id": "gold-crown",
    "name": "勇氣皇冠",
    "slot": "head",
    "src": "/gold-crown-native-v5.png",
    "width": 1254,
    "height": 1254,
    "atlas": false,
    "grip": [
      650,
      810
    ],
    "scale": 0.086
  },
  {
    "id": "blue-cape",
    "name": "藍天披風",
    "slot": "cape",
    "src": "/blue-cape-native-v4.png",
    "width": 1774,
    "height": 887,
    "atlas": true
  },
  {
    "id": "gold-cape",
    "name": "晨光披風",
    "slot": "cape",
    "src": "/gold-cape-native-v4.png",
    "width": 1774,
    "height": 887,
    "atlas": true
  },
  {
    "id": "moon-cape",
    "name": "月影披風",
    "slot": "cape",
    "src": "/moon-cape-native-v4.png",
    "width": 1774,
    "height": 887,
    "atlas": true
  },
  {
    "id": "forest-armor",
    "name": "森旅胸甲",
    "slot": "armor",
    "src": "/forest-armor-native-v4.png",
    "width": 1774,
    "height": 887,
    "atlas": true
  },
  {
    "id": "star-armor",
    "name": "星輝胸甲",
    "slot": "armor",
    "src": "/star-armor-native-v4.png",
    "width": 1774,
    "height": 887,
    "atlas": true
  },
  {
    "id": "moon-armor",
    "name": "月冠胸甲",
    "slot": "armor",
    "src": "/moon-armor-native-v4.png",
    "width": 1774,
    "height": 887,
    "atlas": true
  },
  {
    "id": "forest-boots",
    "name": "森旅皮靴",
    "slot": "boots",
    "src": "/forest-boots-native-v4.png",
    "width": 1774,
    "height": 887,
    "atlas": true
  },
  {
    "id": "star-boots",
    "name": "星輝長靴",
    "slot": "boots",
    "src": "/star-boots-native-v4.png",
    "width": 1774,
    "height": 887,
    "atlas": true
  },
  {
    "id": "moon-boots",
    "name": "月冠甲靴",
    "slot": "boots",
    "src": "/moon-boots-native-v4.png",
    "width": 1774,
    "height": 887,
    "atlas": true
  }
].map(item=>Object.freeze({...item,src:NATIVE_ASSETS[item.src]})));
export const NATIVE_SLOTS=Object.freeze(["weapon","shield","head","cape","armor","boots"]);
