# Proximos pasos desarrollo

# 1: Restructurar sistema de carpetas de la app. Seguir estructura de feature.

- Especificar que los archivos de angular esten simpre estructurados con TS, HTML y CSS separados.

# 2: Eliminar componentes de angular material.

# Prioritario:

- MatIconModule - Revisar alternativa
- MatStepperModule
- MatRadioModule
- MatButtonModule
- MatProgressBarModule
- MatSelectModule
- MatFormFieldModule
- MatInputModule
- MatCardModule
- MatMenuModule
- MatMenuTrigger
- MatExpansionModule
- MatChipsModule
- MatListModule
- MatDividerModule
- MatProgressSpinnerModule
- MatCheckboxModule
- MatTooltipModule

# Opcional:

- MatDatepickerModule, MatNativeDateModule, MatRangeDatePicker
- MatSidenavModule
- MatSidenav
- MatDialog, MatDialogModule,MatDialogRef, MAT_DIALOG_DATA, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose,
- MatSnackBar, MatSnackBarModule

# Reeglas para optimización agentica:

- Usar siempre el nuevo control flow @if, @for

# (opt) Actualizar libreria de material icon¿?

# 2: Hay una pantalla que no está en uso en la feature de "sesiones".

# 3: Rehacer componente perfil.

# 2: Si se elimina el mat dialog, revisar el componente inicio (mensaje logout) y perfil (Verificaciones de formularios)

# 4: Definir claramente los media-query para el reestilizado.

## Reglas generales a imponer:

- Especificar que los archivos de angular esten siempre estructurados con TS, HTML y CSS separados. Preguntar internet por performance en LLM.
-

# Reglas de estilo:

- Utilizar siempre que se pueda Tailwind.
- Utilizar color primario: #e75c3e
- Color secundario: #fff
- Color accent:
- Fuente principal: Galvji;
- Fuente titulos: KengoFont;

# 5: Eliminar el archivo theme.scss (Requiere eliminar angular material)

## Tamaño del build con elementos de angular material:

Initial chunk files | Names | Raw size
main.js | main | 936.23 kB |
styles.css | styles | 120.74 kB |
chunk-43GB66GW.js | - | 32.47 kB |
chunk-EC6C4QA7.js | - | 9.60 kB |
chunk-2JQWK4IQ.js | - | 7.84 kB |
chunk-NRUJRF3L.js | - | 5.85 kB |
chunk-EVSPGG2W.js | - | 1.64 kB |
polyfills.js | polyfills | 95 bytes |

                    | Initial total                    |   1.11 MB

Lazy chunk files | Names | Raw size
chunk-AR246DVZ.js | realizar-plan-component | 140.57 kB |
chunk-QVF57KIT.js | actividad-diaria-component | 59.24 kB |
chunk-SVPZ7QXU.js | selector-rutina-component | 23.63 kB |
chunk-UID5URR3.js | selector-paciente-component | 19.84 kB |
chunk-KLBVYPMC.js | dialogo-guardar-rutina-component | 11.91 kB |

# ANTES DE IA:

Initial chunk files | Names | Raw size
main.js | main | 909.61 kB |
styles.css | styles | 117.94 kB |
chunk-43GB66GW.js | - | 32.47 kB |
chunk-EC6C4QA7.js | - | 9.60 kB |
chunk-2JQWK4IQ.js | - | 7.84 kB |
chunk-NRUJRF3L.js | - | 5.85 kB |
chunk-EVSPGG2W.js | - | 1.64 kB |
polyfills.js | polyfills | 95 bytes |

                    | Initial total                    |   1.09 MB

Lazy chunk files | Names | Raw size
chunk-AR246DVZ.js | realizar-plan-component | 140.57 kB |
chunk-VTYIIWCW.js | actividad-diaria-component | 59.04 kB |
chunk-SVPZ7QXU.js | selector-rutina-component | 23.63 kB |
chunk-UID5URR3.js | selector-paciente-component | 19.84 kB |
chunk-KLBVYPMC.js | dialogo-guardar-rutina-component | 11.91 kB |

# Despues de reestructuracion:

Initial chunk files | Names | Raw size
styles.css | styles | 117.94 kB |
main.js | main | 53.44 kB |
chunk-IA33OIIX.js | - | 49.30 kB |
chunk-TOVYOX63.js | - | 19.23 kB |
chunk-KJAWSIM5.js | - | 9.64 kB |
chunk-7PTQKXEY.js | - | 5.91 kB |
chunk-YEVB73SE.js | - | 4.12 kB |
chunk-EVSPGG2W.js | - | 1.64 kB |
polyfills.js | polyfills | 95 bytes |

                    | Initial total                    | 261.32 kB

Lazy chunk files | Names | Raw size
chunk-GJSBUW2D.js | realizar-plan-component | 141.54 kB |
chunk-WUE6G3XT.js | perfil-component | 108.17 kB |
chunk-IXE7PTAV.js | planes-component | 96.59 kB |
chunk-B6CHKS53.js | plan-builder-component | 90.85 kB |
chunk-IRRKKQ6C.js39m | inicio-component | 79.43 kB |
chunk-MG526N57.js | paciente-detail-component | 75.16 kB |
chunk-ON5AQPKX.js | ejercicios-list-component | 72.63 kB |
chunk-OOGXX3CK.js | miclinica-component | 71.74 kB |
chunk-QRUB62ZT.js | actividad-diaria-component | 59.17 kB |
chunk-TSNEKMSW.js | pacientes-list-component | 45.30 kB |
chunk-VCLEH4XO.js | ejercicio-detail-component | 31.30 kB |
chunk-MHA6V7JH.js | plan-resumen-component | 30.38 kB |
chunk-4EOYVV4X.js | - | 25.28 kB |
chunk-7X3RRD4X.js | selector-rutina-component | 23.75 kB |
chunk-FZ4RIK5K.js | selector-paciente-component | 19.91 kB |
chunk-QGQCMTS4.js | registro-component | 17.75 kB |
chunk-OKE4LXCN.js | - | 17.42 kB |
chunk-MMKB3AX5.js | categorias-component | 16.70 kB |
chunk-BT7BVVG5.js | - | 15.23 kB |
chunk-CHWX2AXV.js | fisios-component | 13.79 kB |
chunk-2ZZIYIIK.js | login-component | 13.03 kB |
chunk-ROH6WXG5.js | dialogo-guardar-rutina-component | 12.03 kB |
chunk-AIIZJ2VQ.js | - | 9.69 kB |
chunk-XWFCY7DW.js | - | 7.93 kB |
chunk-BJUGXS5G.js | magic-component | 5.86 kB |
chunk-RYA2ZYJU.js | - | 1.03 kB |
chunk-W7EI6EJC.js | ejercicios-routes | 604 bytes |
chunk-UD6KGSCR.js | pacientes-routes | 598 bytes |

# Entrega del 28 de enero (Con white label incluido)

Initial chunk files | Names | Raw size
chunk-SV2X2TCC.js | - | 221.38 kB |
styles.css | styles | 122.92 kB |
main.js | main | 70.90 kB |
chunk-DBY234TE.js | - | 57.95 kB |
chunk-3PWOKBUV.js | - | 35.78 kB |
chunk-3PHFHDE4.js | - | 31.11 kB |
chunk-4ARVVA6Y.js | - | 22.70 kB |
chunk-TS52EIDY.js | - | 11.65 kB |
chunk-3EXXTX3C.js | - | 9.97 kB |
chunk-T6CCJJPZ.js | - | 7.02 kB |
chunk-R7B6XIFM.js | - | 5.77 kB |
chunk-FJ3TDFB5.js | - | 5.08 kB |
chunk-Y5RQAIA6.js | - | 1.50 kB |
chunk-RYA2ZYJU.js | - | 1.03 kB |
polyfills.js | polyfills | 95 bytes |

                    | Initial total                    | 604.85 kB

Lazy chunk files | Names | Raw size
chunk-7M3OWRO6.js | miclinica-component | 479.18 kB |
chunk-44G7WCC6.js | realizar-plan-component | 290.73 kB |
chunk-AC2D3OXK.js | paciente-detail-component | 231.83 kB |
chunk-GLHTD5QA.js | perfil-component | 207.23 kB |
chunk-MLQG2ZWF.js | plan-builder-component | 163.63 kB |
chunk-2PLHQJQF.js | actividad-hoy-component | 150.57 kB |
chunk-VLEPHWBV.js | ejercicio-detail-component | 138.23 kB |
chunk-7YRY2RX2.js | planes-component | 128.30 kB |
chunk-5IT2DCFS.js | plan-detail-component | 116.96 kB |
chunk-DMJBRIRN.js | inicio-component | 116.75 kB |
chunk-K3ZSTRUZ.js | pacientes-list-component | 105.89 kB |
chunk-C3QQQEVW.js | actividad-calendario-component | 100.97 kB |
chunk-FOXTCRPL.js | ejercicios-list-component | 93.20 kB |
chunk-Z35R4SNV.js | rutinas-list-component | 81.56 kB |
chunk-4SBNFJDP.js | actividad-estadisticas-component | 81.01 kB |
chunk-KRKLLROU.js | rutina-builder-component | 70.94 kB |
chunk-TP7AXGOU.js | registro-component | 41.37 kB |
chunk-4XG7PWGY.js | - | 32.13 kB |
chunk-EWP7D75I.js | selector-rutina-component | 27.40 kB |
chunk-MKRDVFWI.js | actividad-routes | 26.11 kB |
chunk-6KVB42BT.js | reset-password-component | 25.52 kB |
chunk-HWMWZV37.js | - | 19.45 kB |
chunk-5K2TJOXE.js | recuperar-password-component | 16.21 kB |
chunk-MIZ7LOA3.js | - | 15.28 kB |
chunk-64PG6A3Y.js | login-component | 15.18 kB |
chunk-WSRI774W.js | dialogo-guardar-rutina-component | 13.56 kB |
chunk-XE7T6CNG.js | - | 9.69 kB |
chunk-WT7JBRG7.js | - | 9.28 kB |
chunk-7CZPHH4S.js | magic-component | 8.66 kB |
chunk-LFIAZJC2.js | - | 7.93 kB |
chunk-PF6BMIU3.js | ejercicios-routes | 784 bytes |
chunk-DWVXU3R4.js | pacientes-routes | 778 bytes |
chunk-2IQYZJRC.js | galeria-routes | 485 bytes |
chunk-F7EUFJYH.js | selector-paciente-component | 210 bytes |
