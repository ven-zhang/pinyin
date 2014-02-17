/**
 * pinyin(hans[, options]);
 * 极速，灵活，全面的拼音转换算法。
 *
 * @author 闲耘™ (@hotoo <hotoo.cn[AT]gmail.com>)
 * @version 2013/01/28, v2.1
 */

// FIXME: 其他几种风格的拼音测试未通过。

// 分词模块
var Segment = require("segment").Segment;
var segment = new Segment();
// 使用默认的识别模块及字典
segment.useDefault();

// 词语拼音库。
var PHRASES_DICT = require("./phrases-dict");

// 拼音词库，node 版无需使用压缩合并的拼音库。
var PINYIN_DICT = require("./dict-zi");

// 声母表。
var INITIALS = "zh,ch,sh,b,p,m,f,d,t,n,l,g,k,h,j,q,x,r,z,c,s,yu,y,w".split(",");
// 韵母表。
var FINALS = "ang,eng,ing,ong,an,en,in,un,er,ai,ei,ui,ao,ou,iu,ie,ve,a,o,e,i,u,v".split(",");
var PINYIN_STYLE =  {
  NORMAL: 0,  // 普通风格，不带音标。
  TONE: 1,    // 标准风格，音标在韵母的第一个字母上。
  TONE2: 2,   // 声调中拼音之后，使用数字 1~4 标识。
  INITIALS: 3,// 仅需要声母部分。
  FIRST_LETTER: 4 // 仅保留首字母。
};
// 带音标字符。
var PHONETIC_SYMBOL = require("./phonetic-symbol.js");
var re_phonetic_symbol_source = "";
for(var k in PHONETIC_SYMBOL){
    re_phonetic_symbol_source += k;
}
var RE_PHONETIC_SYMBOL = new RegExp('(['+re_phonetic_symbol_source+'])', 'g');
var RE_TONE2 = /([aeoiuvnm])([0-4])$/;
var DEFAULT_OPTIONS = {
  style: PINYIN_STYLE.TONE, // 风格
  heteronym: false // 多音字
};

// merge
// @parma {Object} 不定项参数。
// @return {Object} 新的对象。
function merge( /* ... */ ){
  var obj = {};
  for(var i=0,l=arguments.length; i<l; i++){
    for(var k in arguments[i]){
      if(!arguments[i].hasOwnProperty(k)){continue;}
      obj[k] = arguments[i][k];
    }
  }
  return obj;
}

// 将 more 的属性值，覆盖 origin 中已有的属性。
// @return 返回新的对象。
function extend(origin, more){
  var obj = {};
  for(var k in origin){
    if(more.hasOwnProperty(k)){
      obj[k] = more[k]
    }else{
      obj[k] = origin[k]
    }
  }
  return obj;
}

/**
 * 修改拼音词库表中的格式。
 * @param {String} pinyin, 单个拼音。
 * @param {PINYIN_STYLE} style, 拼音风格。
 * @return {String}
 */
function toFixed(pinyin, style){
  var tone = ""; // 声调。
  switch(style){
  case PINYIN_STYLE.INITIALS:
    return initials(pinyin);

  case PINYIN_STYLE.FIRST_LETTER:
    var first_letter = pinyin.charAt(0);
    if(PHONETIC_SYMBOL.hasOwnProperty(first_letter)){
      first_letter = PHONETIC_SYMBOL[first_letter].charAt(0);
    }
    return first_letter;

  case PINYIN_STYLE.NORMAL:
    return pinyin.replace(RE_PHONETIC_SYMBOL, function($0, $1_phonetic){
      return PHONETIC_SYMBOL[$1_phonetic].replace(RE_TONE2, "$1");
    });

  case PINYIN_STYLE.TONE2:
    var py = pinyin.replace(RE_PHONETIC_SYMBOL, function($0, $1){
      // 声调数值。
      tone = PHONETIC_SYMBOL[$1].replace(RE_TONE2, "$2");

      return PHONETIC_SYMBOL[$1].replace(RE_TONE2, "$1");
    });
    return py + tone;

  case PINYIN_STYLE.TONE:
  default:
    return pinyin;
  }
}

/**
 * 单字拼音转换。
 * @param {String} han, 单个汉字
 * @return {Array} 返回拼音列表，多音字会有多个拼音项。
 */
function single_pinyin(han, options){

  if("string" !== typeof han){return [];}
  if(han.length !== 1){
    return single_pinyin(han.charAt(0), options);
  }

  options = extend(DEFAULT_OPTIONS, options);
  var hanCode = han.charCodeAt(0);

  if(!PINYIN_DICT[hanCode]){return [han];}

  var pys = PINYIN_DICT[hanCode].split(",");
  if(!options.heteronym){
    return [toFixed(pys[0], options.style)];
  }

  // 临时存储已存在的拼音，避免多音字拼音转换为非注音风格出现重复。
  var py_cached = {};
  var pinyins = [];
  for(var i=0,py,l=pys.length; i<l; i++){
    py = toFixed(pys[i], options.style);
    if(py_cached.hasOwnProperty(py)){continue;}
    py_cached[py] = py;

    pinyins.push(py);
  }
  return pinyins;
}

/**
 * 词语注音
 * @param {String} phrases, 指定的词组。
 * @param {Object} options, 选项。
 * @return {Array}
 */
function phrases_pinyin(phrases, options){
  var py = [];
  if(PHRASES_DICT.hasOwnProperty(phrases)){
    //! copy pinyin result.
    py = PHRASES_DICT[phrases].slice();
    py.forEach(function(item, idx, arr){
      arr[idx] = [toFixed(item[0], options.style)];
    });
  }else{
    for(var i=0,l=phrases.length; i<l; i++){
      py.push(single_pinyin(phrases[i], options));
    }
  }
  return py;
}

/**
 * @param {String} hans 要转为拼音的目标字符串（汉字）。
 * @param {Object} options, 可选，用于指定拼音风格，是否启用多音字。
 * @return {Array} 返回的拼音列表。
 */
function pinyin(hans, options){

  if("string" !== typeof hans){return [];}

  options = extend(DEFAULT_OPTIONS, options);

  var phrases = segment.doSegment(hans);
  var len = hans.length;
  var pys = [];

  for(var i=0,nohans="",firstCharCode,words,l=phrases.length; i<l; i++){

    words = phrases[i].w;
    firstCharCode = words.charCodeAt(0);

    if(PINYIN_DICT[firstCharCode]){

      // ends of non-chinese words.
      if(nohans.length > 0){
        pys.push([nohans]);
        nohans = ""; // reset non-chinese words.
      }

      if(words.length===1){
          pys.push(single_pinyin(words, options));
      }else{
        pys = pys.concat(phrases_pinyin(words, options));
      }

    }else{
      nohans += words;
    }
  }

  // 清理最后的非中文字符串。
  if(nohans.length > 0){
    pys.push([nohans]);
    nohans = ""; // reset non-chinese words.
  }
  return pys;
}


/**
 * 声母(Initials)、韵母(Finals)。
 * @param {String/Number/RegExp/Date/Function/Array/Object}
 * @return {String/Number/RegExp/Date/Function/Array/Object}
 */
function initials(pinyin){
  for(var i=0,l=INITIALS.length; i<l; i++){
    if(pinyin.indexOf(INITIALS[i]) === 0){
      return INITIALS[i];
    }
  }
  return "";
}

module.exports = pinyin;
module.exports.STYLE_NORMAL = PINYIN_STYLE.NORMAL;
module.exports.STYLE_TONE = PINYIN_STYLE.TONE;
module.exports.STYLE_TONE2 = PINYIN_STYLE.TONE2;
module.exports.STYLE_INITIALS = PINYIN_STYLE.INITIALS;
module.exports.STYLE_FIRST_LETTER = PINYIN_STYLE.FIRST_LETTER;
