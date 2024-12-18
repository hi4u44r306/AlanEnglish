export const COLORS = {
  blue: '#5784e9',
  main: 'white',
  musicplayer: '#ebd5d5',
  // main: '#fbf0ea',
  primary: "#001F2D",
  secondary: "#4D626C",
  black: 'black',
  white: "#FFF",
  gray: "#74858C",
  // ricewhite: "#fcf8ec",//這是原本的
  ricewhite: "#e5cabf",
  inputfieldgreen: "#2e9421",
  lightgray: '#e8e3e3'
};

export const SIZES = {
  base: 8,
  small: 12,
  font: 15,
  medium: 16,
  large: 18,
  extraLarge: 24,
};

export const FONTS = {
  mainFont: "AbhayaLibre",
  bold: "InterBold",
  semiBold: "InterSemiBold",
  medium: "InterMedium",
  regular: "InterRegular",
  light: "InterLight",
  VarelaRound: "VarelaRound",
  LibreRegular: "LibreRegular",
  LibreBold: "LibreBold",
  font: "Libre Baskerville",
  font1: 'Garamond',
};

export const SHADOWS = {
  light: {
    shadowColor: COLORS.gray,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,

    elevation: 3,
  },
  medium: {
    shadowColor: COLORS.gray,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.29,
    shadowRadius: 4.65,

    elevation: 7,
  },
  dark: {
    shadowColor: COLORS.gray,
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.41,
    shadowRadius: 9.11,

    elevation: 14,
  },
};
