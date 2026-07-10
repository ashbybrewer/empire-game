export interface RegionGeography {
  polygon: [number, number][]
  label: [number, number]
}

/**
 * Lon/lat polygons for the colonial scramble atlas.
 * North America is a contiguous continental claim race (Atlantic → Ohio → Mississippi → Plains → Pacific),
 * not a hollow west/east split. Coastal Africa, the Caribbean, and Asia are densely claimable.
 */
export const regionGeography: Record<string, RegionGeography> = {
  // —— North America (contiguous continental spine) ——
  'canadian-maritimes': {
    polygon: [[-68, 43], [-52, 46], [-55, 52], [-66, 52], [-68, 43]],
    label: [-60, 48],
  },
  'great-lakes': {
    polygon: [[-96, 42], [-78, 41], [-70, 46], [-72, 52], [-94, 54], [-96, 42]],
    label: [-84, 47],
  },
  'atlantic-seaboard': {
    polygon: [[-82, 30], [-74, 35], [-67, 41], [-70, 46], [-78, 41], [-82, 36], [-82, 30]],
    label: [-74, 38],
  },
  'ohio-valley': {
    polygon: [[-96, 36], [-82, 36], [-78, 41], [-96, 42], [-96, 36]],
    label: [-88, 39],
  },
  'mississippi-basin': {
    polygon: [[-101, 28], [-82, 28], [-82, 36], [-96, 36], [-101, 33], [-101, 28]],
    label: [-91, 32],
  },
  'northern-plains': {
    polygon: [[-114, 42], [-96, 42], [-94, 54], [-112, 55], [-114, 42]],
    label: [-105, 48],
  },
  'southern-plains': {
    polygon: [[-114, 31], [-101, 28], [-101, 33], [-96, 36], [-96, 42], [-114, 42], [-114, 31]],
    label: [-106, 36],
  },
  'pacific-northwest': {
    polygon: [[-136, 42], [-117, 42], [-114, 49], [-120, 59], [-136, 60], [-136, 42]],
    label: [-126, 51],
  },
  california: {
    polygon: [[-125, 31], [-114, 31], [-114, 42], [-125, 42], [-125, 31]],
    label: [-119, 36],
  },
  'mexican-heartland': {
    polygon: [[-118, 14], [-86, 14], [-82, 28], [-101, 28], [-114, 31], [-118, 14]],
    label: [-100, 22],
  },
  cuba: {
    polygon: [[-85, 19], [-74, 19], [-74, 23.5], [-85, 23.5], [-85, 19]],
    label: [-79.5, 21.5],
  },
  jamaica: {
    polygon: [[-79, 17], [-75.5, 17], [-75.5, 19], [-79, 19], [-79, 17]],
    label: [-77.2, 18],
  },

  // —— South America ——
  guianas: {
    polygon: [[-62, 1], [-50, 1], [-50, 8], [-60, 8], [-62, 1]],
    label: [-56, 5],
  },
  'new-granada': {
    polygon: [[-83, -5], [-62, -5], [-60, 8], [-73, 13], [-82, 10], [-83, -5]],
    label: [-72, 4],
  },
  'amazon-basin': {
    polygon: [[-74, -12], [-50, -12], [-50, 1], [-62, 1], [-62, -5], [-74, -5], [-74, -12]],
    label: [-60, -6],
  },
  'brazilian-coast': {
    polygon: [[-50, -28], [-34, -28], [-34, 5], [-50, 5], [-50, -28]],
    label: [-42, -12],
  },
  'andean-highlands': {
    polygon: [[-81, -28], [-67, -28], [-65, -5], [-74, -5], [-81, -28]],
    label: [-73, -16],
  },
  'peru-bolivia': {
    polygon: [[-75, -25], [-60, -25], [-60, -12], [-74, -12], [-75, -25]],
    label: [-67, -18],
  },
  'chilean-republic': {
    polygon: [[-76, -42], [-70, -42], [-68, -25], [-75, -25], [-76, -42]],
    label: [-72, -33],
  },
  'argentine-confederation': {
    polygon: [[-70, -42], [-52, -42], [-52, -28], [-67, -28], [-70, -42]],
    label: [-60, -35],
  },
  'mapuche-country': {
    polygon: [[-76, -56], [-64, -56], [-67, -42], [-76, -42], [-76, -56]],
    label: [-70, -48],
  },

  // —— Europe (mother countries) ——
  'british-isles': {
    polygon: [[-12, 49], [3, 49], [3, 61], [-12, 61], [-12, 49]],
    label: [-4, 55],
  },
  france: {
    polygon: [[-5, 42], [9, 42], [9, 51], [-5, 51], [-5, 42]],
    label: [2, 47],
  },
  'low-countries': {
    polygon: [[2, 49], [8, 49], [8, 54], [2, 54], [2, 49]],
    label: [5, 51.5],
  },
  spain: {
    polygon: [[-10, 36], [4, 36], [4, 44], [-6, 44], [-10, 42], [-10, 36]],
    label: [-3, 40],
  },
  portugal: {
    polygon: [[-10, 36], [-6, 36], [-6, 42], [-10, 42], [-10, 36]],
    label: [-8.2, 39],
  },
  prussia: {
    polygon: [[8, 48], [22, 48], [22, 55], [8, 55], [8, 48]],
    label: [15, 52],
  },
  'austrian-empire': {
    polygon: [[9, 44], [26, 44], [26, 49], [9, 49], [9, 44]],
    label: [17, 47],
  },
  'russian-empire': {
    polygon: [[22, 48], [40, 40], [70, 44], [100, 50], [135, 51], [165, 57], [179, 61], [179, 72], [25, 72], [22, 48]],
    label: [72, 58],
  },
  'ottoman-heartlands': {
    polygon: [[19, 35], [45, 35], [45, 43], [29, 48], [19, 45], [19, 35]],
    label: [33, 40],
  },

  // —— Africa (dense scramble coast + interior nations) ——
  morocco: {
    polygon: [[-13, 27], [-1, 27], [-1, 36], [-13, 36], [-13, 27]],
    label: [-7, 32],
  },
  'algerian-emirate': {
    polygon: [[-1, 20], [12, 20], [12, 37], [-1, 37], [-1, 20]],
    label: [5, 29],
  },
  egypt: {
    polygon: [[25, 20], [37, 20], [37, 32], [25, 32], [25, 20]],
    label: [31, 27],
  },
  senegal: {
    polygon: [[-18, 10], [-11, 10], [-11, 17], [-18, 17], [-18, 10]],
    label: [-14.5, 13.5],
  },
  sokoto: {
    polygon: [[-11, 10], [15, 10], [15, 20], [-11, 20], [-11, 10]],
    label: [2, 15],
  },
  'gold-coast': {
    polygon: [[-8, 4], [0, 4], [0, 10], [-8, 10], [-8, 4]],
    label: [-4, 7],
  },
  dahomey: {
    polygon: [[0, 4], [5, 4], [5, 10], [0, 10], [0, 4]],
    label: [2.5, 7],
  },
  'slave-coast': {
    polygon: [[5, 4], [10, 4], [10, 10], [5, 10], [5, 4]],
    label: [7.5, 7],
  },
  'ethiopian-highlands': {
    polygon: [[32, 3], [48, 3], [48, 15], [34, 16], [32, 3]],
    label: [40, 10],
  },
  'east-africa-coast': {
    polygon: [[38, -12], [52, -12], [52, 4], [40, 4], [38, -12]],
    label: [45, -3],
  },
  angola: {
    polygon: [[11, -18], [24, -18], [24, -4], [11, -4], [11, -18]],
    label: [17.5, -11],
  },
  'kongo-basin': {
    polygon: [[14, -4], [32, -4], [32, 4], [10, 4], [10, 0], [14, -4]],
    label: [22, 0],
  },
  mozambique: {
    polygon: [[30, -27], [41, -27], [41, -10], [32, -10], [30, -27]],
    label: [35.5, -18],
  },
  'cape-colony': {
    polygon: [[14, -35], [28, -35], [29, -22], [15, -22], [14, -35]],
    label: [20, -29],
  },
  'zulu-kingdom': {
    polygon: [[28, -35], [36, -35], [36, -22], [29, -22], [28, -35]],
    label: [31.5, -29],
  },
  'merina-kingdom': {
    polygon: [[43, -26], [51, -26], [51, -12], [43, -12], [43, -26]],
    label: [47, -19],
  },

  // —— Asia ——
  'qajar-iran': {
    polygon: [[44, 24], [62, 24], [62, 40], [44, 40], [44, 24]],
    label: [53, 32],
  },
  'afghan-emirate': {
    polygon: [[60, 28], [73, 28], [75, 37], [60, 37], [60, 28]],
    label: [67, 33],
  },
  punjab: {
    polygon: [[68, 26], [78, 26], [78, 35], [68, 35], [68, 26]],
    label: [73, 31],
  },
  bengal: {
    polygon: [[78, 20], [92, 20], [92, 27], [78, 27], [78, 20]],
    label: [86.5, 23],
  },
  deccan: {
    polygon: [[68, 7], [82, 7], [82, 26], [68, 26], [68, 7]],
    label: [75, 16],
  },
  'madras-coast': {
    polygon: [[78, 7], [86, 7], [86, 16], [82, 16], [82, 7], [78, 7]],
    label: [83, 11],
  },
  'konbaung-burma': {
    polygon: [[92, 9], [102, 9], [102, 28], [92, 28], [92, 9]],
    label: [97, 19],
  },
  siam: {
    polygon: [[97, 5], [106, 5], [106, 21], [97, 21], [97, 5]],
    label: [102, 14],
  },
  'dai-nam': {
    polygon: [[103, 8], [110, 8], [110, 24], [103, 24], [103, 8]],
    label: [107, 17],
  },
  'south-china': {
    polygon: [[102, 18], [122, 18], [122, 33], [102, 33], [102, 18]],
    label: [113, 25],
  },
  'north-china': {
    polygon: [[83, 33], [126, 33], [126, 53], [83, 53], [83, 33]],
    label: [105, 42],
  },
  'tokugawa-japan': {
    polygon: [[129, 30], [146, 30], [146, 46], [129, 46], [129, 30]],
    label: [138, 38],
  },
  java: {
    polygon: [[105, -10], [115, -10], [115, -5], [105, -5], [105, -10]],
    label: [110, -7],
  },
  philippines: {
    polygon: [[117, 5], [127, 5], [127, 19], [117, 19], [117, 5]],
    label: [122, 12],
  },
  australia: {
    polygon: [[112, -40], [154, -40], [154, -12], [112, -12], [112, -40]],
    label: [134, -26],
  },
}
