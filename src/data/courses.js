// Course code -> { name (full Azerbaijani title), hours (total teaching
// hours), shortName (official abbreviation) }.
//
// `hours` values are unchanged from the system's existing, previously
// verified course-duration data.
//
// `name` / `shortName` are updated to match the official course catalog
// supplied for this update. Used by the table, Training Plan, Jurnal and Protokol.
const courses = {
  SP: { name: 'Əmniyyətli İdarəetmə haqqında Beynəlxalq Məcəllə',                    hours: 16,  shortName: 'ƏİHBM'         },
  SI: { name: 'Gəminin Mühafizəsi üzrə ümumi hazırlıq və təlimat',                   hours: 8,   shortName: 'GMÜHT'          },
  SH: { name: 'Gəminin Mühafizəsi üzrə müəyyən edilmiş vəzifələrə malik şəxslər',    hours: 16,  shortName: 'GMMEVMŞH'       },
  RS: { name: 'Gəmi Əmniyyətliyi üzrə Məsul Şəxs',                                   hours: 48,  shortName: 'GƏÜMŞ'          },
  SG: { name: 'Gəmi mühafizəsi üzrə məsul Şəxs',                                     hours: 18,  shortName: 'GMMŞ'           },
  SO: { name: 'Bütün dənizçilər üçün təhlükəsizlik üzrə tanışlıq və təlimat',        hours: 80,  shortName: 'BDÜTTİHT'       },
  SW: { name: 'Kapitan Körpüsü Resurslarının İdarə Olunması',                         hours: 42,  shortName: 'KKRİO'          },
  SV: { name: 'Gəminin İdarə Olunması və Manevr Edilməsi',                            hours: 40,  shortName: 'GİOME'          },
  SQ: { name: 'Radar, ARPA, körpü komandası və axtarış-xilasetmə (idarəetmə)',        hours: 40,  shortName: 'RARMVAX'        },
  SR: { name: 'Radar müşahidəsi və ARPA-nın istismarı (operativ səviyyə)',             hours: 98,  shortName: 'RMTARMV'        },
  SZ: { name: 'Elektron Xəritə Displeyi və İnformasiya Sistemlərinin İstismarı',      hours: 40,  shortName: 'ECDİS'          },
  SF: { name: 'Yanğınla mübarizə üzrə geniş hazırlıq',                                hours: 18,  shortName: 'YMGP'           },
  SD: { name: 'Sərnişin baxımı, yük təhlükəsizliyi və humanitar ünsiyyət təlimi',    hours: 8,   shortName: 'SBXGHÜTH'       },
  SC: { name: 'İzdihamın idarə olunması üzrə hazırlıq',                               hours: 11,  shortName: 'İİOH'           },
  SE: { name: 'Böhran zamanı idarəetmə və insan davranışı üzrə hazırlıq',             hours: 16,  shortName: 'BZİİDH'         },
  ST: { name: 'Gəmi qaz analizatorları və onların istismarı',                          hours: 8,   shortName: 'GQAOİ'          },
  SX: { name: 'İnert qaz sistemi',                                                     hours: 16,  shortName: 'İQS'            },
  SN: { name: 'Gəmidə ilk tibbi yardım',                                               hours: 34,  shortName: 'GTY'            },
  SM: { name: 'Gəmidə tibbi nəzarət',                                                  hours: 47,  shortName: 'GTN'            },
  DQ: { name: 'Qlobal Dəniz Fəlakət və Əmniyyətli Rabitə Sisteminin Operatoru',       hours: 110, shortName: 'QDFƏRSÜO'       },
  SA: { name: 'Neft və kimyəvi tankerlərdə yük əməliyyatına dair ilkin hazırlıq',     hours: 48,  shortName: 'Tanker (İlkin)' },
  SB: { name: 'Neft tankerlərdə geniş proqram üzrə hazırlıq',                         hours: 55,  shortName: 'NTYGPH'         },
  AS: { name: 'Kimyəvi tankerlərdə geniş proqram üzrə hazırlıq',                      hours: 60,  shortName: 'KMDTYGP'        },
  SK: { name: 'Təhlükəli və zərərli yüklərin daşınması',                               hours: 34,  shortName: 'TZYD'           },
  ER: { name: 'Maşın şöbəsinin resurslarının idarə olunması',                          hours: 37,  shortName: 'MŞRİO'          },
  DL: { name: 'Liderlik və heyətlə iş birliyi',                                        hours: 20,  shortName: 'LHİB'           },
  SJ: { name: 'Yanğınla mübarizə geniş proqram üzrə',                                 hours: 32,  shortName: 'YMGP'           },
  SL: { name: 'Sürətli olmayan xilasedici qayıq üzrə mütəxəssis',                     hours: 32,  shortName: 'SOXQ'           },
  SU: { name: 'Sürətli xilasetmə qayıqları üzrə mütəxəssis',                          hours: 20,  shortName: 'SXQM'           },
  WS: { name: 'Liman Vasitələrinin mühafizəsinə məsul şəxsin hazırlığı',              hours: 20,  shortName: 'LVMMŞ'          },
  XS: { name: 'Gəmi sürücüləri və mexaniklər üçün təkmilləşdirmə təlimi',             hours: 24,  shortName: 'GST'            },
};

export const getCourseName      = (code) => courses[code]?.name      || 'Ad təyin olunmayıb';
export const getCourseHours     = (code) => courses[code]?.hours     || 0;
export const getCourseShortName = (code) => courses[code]?.shortName || '';
export const getCourseInfo      = (code) => courses[code]           || { name: 'Ad təyin olunmayıb', hours: 0, shortName: '' };
export default courses;
