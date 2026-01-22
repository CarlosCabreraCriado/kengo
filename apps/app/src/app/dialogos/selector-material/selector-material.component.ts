import { Component, Input, OnInit, Inject } from "@angular/core";

import { MatButtonModule } from "@angular/material/button";

import { MatDividerModule } from "@angular/material/divider";
import { MatIconModule } from "@angular/material/icon";
import { MatListModule } from "@angular/material/list";

import {
  MatDialogRef,
  MatDialogTitle,
  MatDialogContent,
  MatDialogClose,
  MAT_DIALOG_DATA,
} from "@angular/material/dialog";

interface seccion {
  nombreSeccion: string;
  archivos: archivo[];
}

interface archivo {
  codigo: string;
  nombre: string;
  icono: string;
  url: string;
}

interface DialogData {
  tipo: string;
}

@Component({
  selector: "app-selector-material",
  standalone: true,
  imports: [
    MatDialogClose,
    MatDialogTitle,
    MatDialogContent,
    MatButtonModule,
    MatListModule,
    MatIconModule,
    MatDividerModule,
  ],
  providers: [],
  templateUrl: "./selector-material.component.html",
  styleUrl: "./selector-material.component.scss",
})
export class DialogoMaterialComponent implements OnInit {
  @Input({ required: false }) input: boolean = true;

  constructor(
    public dialogRef: MatDialogRef<DialogoMaterialComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
  ) {}

  public material: seccion[] = [];

  ngOnInit() {
    //console.warn("INIT dialogo material", this.data);
    switch (this.data.tipo) {
      case "Finanzas Personales":
        this.material = [
          {
            nombreSeccion: "Material",
            archivos: [
              {
                codigo: "FxM1",
                nombre: "Cómo gestionar mejor mi economía",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/2023/06/FxM-1-Como-gestionar-mejor-mi-economia.pdf",
              },
              {
                codigo: "FxM2",
                nombre: "Cómo gestionar mis cuentas bancarias",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/2023/06/FxM-2-Como-gestionar-mis-cuentas-bancarias.pdf",
              },
              {
                codigo: "FxM3",
                nombre: "Mis ahorros",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/2023/06/FxM-3-Mis-Ahorros.pdf",
              },
              {
                codigo: "FxM4",
                nombre: "Endeudamiento inteligente",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/2023/06/FxM-4-Endeudamiento-Inteligente.pdf",
              },
              {
                codigo: "F.P.SEG",
                nombre: "Seguridad en tus finanzas",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/Finanzas-Seguras-mar-2025.pdf",
              },
              {
                codigo: "F.SOST",
                nombre: "Sostenibilidad y finanzas",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/2023/06/Sostenibilidad-y-Finanzas-V.-Proyeccion.pdf",
              },
            ],
          },
          {
            nombreSeccion: "Manual para el formador",
            archivos: [
              {
                codigo: "FxM1",
                nombre: "M. Cómo gestionar mejor mi economía",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/2023/06/FxM-1-Como-gestionar-mejor-mi-economia-Manual-Formador.pdf",
              },
              {
                codigo: "FxM2",
                nombre: "M. Cómo gestionar mis cuentas bancarias",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/2023/06/FxM-2-Como-Gestionar-mis-Cuentas-Bancarias-Manual-Formador.pdf",
              },
              {
                codigo: "FxM3",
                nombre: "M. Mis ahorros",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/2023/06/FxM-3-Mis-Ahorros-Manual-del-Formador.pdf",
              },
              {
                codigo: "FxM4",
                nombre: "M. Endeudamiento inteligente",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/2023/06/FxM-4-Endeudamiento-Inteligente-Manual-Formador.pdf",
              },
              {
                codigo: "F.P.SEG",
                nombre: "M. Seguridad en tus finanzas",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/Finanzas-Seguras-Manual-Formador-mar-2025.pdf",
              },
              {
                codigo: "F.SOST",
                nombre: "M. Sostenibilidad y finanzas",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/2023/06/Sostenibilidad-y-Finanzas.-Revision-V.-Formador-1.pdf",
              },
            ],
          },
        ];
        break;

      case "ESO y FP Básica":
        this.material = [
          {
            nombreSeccion: "Material Año 1: Controla tu economía.",
            archivos: [
              {
                codigo: "AF1.1",
                nombre: "¿Sabes hacer un presupuesto?",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/AF-1.1.-Controla-tu-economia.-Sabes-hacer-un-presupuesto.pdf",
              },
              {
                codigo: "AF1.2",
                nombre: "¿De dónde vienen los euros?",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/AF-1.2.-Controla-tu-economia.-De-donde-vienen-los-euros.pdf",
              },
              {
                codigo: "AF1.3",
                nombre: "Aprendiendo a ahorrar",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/AF-1.3.-Controla-tu-economia.-Aprendiendo-a-ahorrar-1.pdf",
              },
              {
                codigo: "AF1.4",
                nombre: "Proyectos solidarios",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/AF-1.4-Controla-tu-economia.-Proyectos-solidarios.pdf",
              },
            ],
          },
          {
            nombreSeccion: "Material Año 2: Entiéndete con los bancos.",
            archivos: [
              {
                codigo: "AF2.1",
                nombre: "Cuentas y tarjetas bancarias",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/AF-2.1-Entiendete-con-los-Bancos.-Cuentas-y-tarjetas-bancarias-1.pdf",
              },
              {
                codigo: "AF2.2",
                nombre: "Los ahorros",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/AF-2.2.-Entiendete-con-los-Bancos.-Los-Ahorros.pdf",
              },
              {
                codigo: "AF2.3",
                nombre: "Endeudamiento inteligente",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/AF-2.3.-Entiendete-con-los-Bancos.-Endeudamiento-inteligente-1.pdf",
              },
              {
                codigo: "AF2.4",
                nombre: "De viaje al extranjero",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/AF-2.4.-Entiendete-con-los-Bancos.-De-viaje-al-extranjero.pdf",
              },
            ],
          },
        ];
        break;

      case "Bachillerato y FP Media":
        this.material = [
          {
            nombreSeccion: "Material General.",
            archivos: [
              {
                codigo: "F.SEG.U",
                nombre: "Seguridad en tus finanzas",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/Finanzas-Seguras-mar-2025.pdf",
              },
            ],
          },
          {
            nombreSeccion: "Material Año 3: La economía de un país.",
            archivos: [
              {
                codigo: "AF3.1",
                nombre: "Principales indicadores",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/AF-3.1.-La-economia-de-un-pais.-Principales-indicadores-economicosok.pdf",
              },
              {
                codigo: "AF3.2",
                nombre:
                  "¿Cómo administrar el dinero de un país de forma eficiente?",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/AF-3.2.-La-economia-de-un-pais.-Como-administrar-el-dinero-de-un-pais-de-forma-eficienteok.pdf",
              },
              {
                codigo: "AF3.3",
                nombre: "¿Cómo gasta un país?",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/AF-3.3.-La-economia-de-un-pais-Como-gasta-un-pais.pdf",
              },
              {
                codigo: "AF3.4",
                nombre: "La jubilación de nuestros padres... ¿Y la nuestra?",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/AF-3.4.-La-economia-de-un-pais-La-jubilacion-de-nuestros-padres.-Y-la-nuestra.pdf",
              },
            ],
          },
          {
            nombreSeccion: "Material año 4: El mundo laboral.",
            archivos: [
              {
                codigo: "AF4.1",
                nombre: "¿Emprendemos?",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/AF-4.1-El-mundo-laboral.-Emprendemos-mar-2025.pdf",
              },
              {
                codigo: "AF4.2",
                nombre: "Tengo un proyecto en mente",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/AF-4.2.-El-mundo-laboral.-Tengo-un-proyecto-en-mente.pdf",
              },
              {
                codigo: "AF4.3",
                nombre: "Monta tu propia empresa",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/AF-4.3-El-mundo-laboral.-Monta-tu-propia-empresa-1.pdf",
              },
              {
                codigo: "AF4.4",
                nombre: "¿Cómo va mi empresa?",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/AF-4.4.-El-mundo-laboral.-Como-va-mi-empresa.pdf",
              },
            ],
          },
          {
            nombreSeccion: "Manuales para el formador",
            archivos: [
              {
                codigo: "F.SEG.U",
                nombre: "M. Seguridad en tus finanzas",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/Finanzas-Seguras-Manual-Formador-mar-2025.pdf",
              },
              {
                codigo: "AF4.1",
                nombre: "M. ¿Emprendemos?",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/AF-4.1-Manual-del-Formador-El-mundo-laboral.-Emprendemos-mar-2025.pdf",
              },
              {
                codigo: "AF4.2",
                nombre: "M. ¿Tengo un proyecto en mente?",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/AF-4.2.-Manual-del-Formador-El-mundo-laboral.-Tengo-un-proyecto-en-mente-mar-2025.pdf",
              },
              {
                codigo: "AF4.3",
                nombre: "M. Monta tu propia empresa",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/AF-4.3-Manual-del-Formador-El-mundo-laboral-Monta-tu-propia-empresa-mar-2025.pdf",
              },
            ],
          },
        ];
        break;

      case "Universitarios y FP Superior":
        this.material = [
          {
            nombreSeccion: "Material",
            archivos: [
              {
                codigo: "PF",
                nombre: "Practicando con las finanzas",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/Practicando-con-las-Finanzas.pdf",
              },
              {
                codigo: "F.SEG.U",
                nombre: "Seguridad en tus finanzas",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/Finanzas-Seguras-mar-2025.pdf",
              },
              {
                codigo: "AF4.1",
                nombre: "¿Emprendemos?",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/AF-4.1-El-mundo-laboral.-Emprendemos-mar-2025.pdf",
              },
              {
                codigo: "AF4.2",
                nombre: "Tengo un proyecto en mente",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/AF-4.2.-El-mundo-laboral.-Tengo-un-proyecto-en-mente.pdf",
              },
              {
                codigo: "AF4.3",
                nombre: "Monta tu propia empresa",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/AF-4.3-El-mundo-laboral.-Monta-tu-propia-empresa.pdf",
              },
              {
                codigo: "AF4.4",
                nombre: "¿Cómo va mi empresa?",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/AF-4.4.-El-mundo-laboral.-Como-va-mi-empresa.pdf",
              },
            ],
          },
          {
            nombreSeccion: "Manual para el formador",
            archivos: [
              {
                codigo: "PF",
                nombre: "M. Practicando con las finanzas",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/Practicando-con-las-Finanzas-Manual-Formador.pdf",
              },
              {
                codigo: "F.SEG.U",
                nombre: "M. Seguridad en tus finanzas",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/Finanzas-Seguras-Manual-Formador-mar-2025.pdf",
              },
              {
                codigo: "AF4.1",
                nombre: "M. ¿Emprendemos?",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/AF-4.1-Manual-del-Formador-El-mundo-laboral.-Emprendemos-mar-2025.pdf",
              },
              {
                codigo: "AF4.2",
                nombre: "M. ¿Tengo un proyecto en mente?",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/AF-4.2.-Manual-del-Formador-El-mundo-laboral.-Tengo-un-proyecto-en-mente-mar-2025.pdf",
              },
              {
                codigo: "AF4.3",
                nombre: "M. Monta tu propia empresa",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/AF-4.3-Manual-del-Formador-El-mundo-laboral-Monta-tu-propia-empresa-mar-2025.pdf",
              },
            ],
          },
        ];
        break;

      case "Emprendimiento para el Empleo":
        this.material = [
          {
            nombreSeccion: "Material",
            archivos: [
              {
                codigo: "EE",
                nombre: "Emprendimiento para el empleo",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/Emprendimiento-para-el-Empleo-1.pdf",
              },
            ],
          },
          {
            nombreSeccion: "Manual para el formador",
            archivos: [
              {
                codigo: "EE",
                nombre: "M. Emprendimiento para el empleo",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/Emprendimiento-para-el-Empleo-Manual-del-Formador-1.pdf",
              },
            ],
          },
        ];
        break;

      case "Edición Junior":
        this.material = [
          {
            nombreSeccion: "Material en url - Canva",
            archivos: [
              {
                codigo: "N1.1",
                nombre: "Primer ciclo pt. 1",
                icono: "description",
                url: "https://www.canva.com/design/DAFgQe_th0o/4xkUT0mje5CJPJYlNTC6kg/view",
              },
              {
                codigo: "N1.2",
                nombre: "Primer ciclo pt. 2",
                icono: "description",
                url: "https://www.canva.com/design/DAFfWYM5FcM/WxXLouDmr1I1Oe42V7i8WQ/view",
              },
              {
                codigo: "N2",
                nombre: "Segundo ciclo",
                icono: "description",
                url: "https://www.canva.com/design/DAFfmngqQYI/g4zhI8drlwFv8K26MHEuUg/view",
              },
              {
                codigo: "N3",
                nombre: "Tercer ciclo",
                icono: "description",
                url: "https://www.canva.com/design/DAGkCMArVqc/XrCE8HlHQh23_PYi8ennFQ/view",
              },
            ],
          },
          {
            nombreSeccion: "Material en PDF",
            archivos: [
              {
                codigo: "N1.1",
                nombre: "Primer ciclo pt. 1",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/Programa-Ninos-1er-ciclo-Pt.-1.pdf",
              },
              {
                codigo: "N1.2",
                nombre: "Primer ciclo pt. 2",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/Programa-Ninos-1er-ciclo-Pt.-2.pdf",
              },
              {
                codigo: "N2",
                nombre: "Segundo ciclo",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/Programa-Ninos-2o-Ciclo.pdf",
              },
              {
                codigo: "N3",
                nombre: "Tercer ciclo",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/Programa-Ninos-3er-Ciclo-1.pdf",
              },
            ],
          },
          {
            nombreSeccion: "Manual para el formador",
            archivos: [
              {
                codigo: "N1.1",
                nombre: "Primer ciclo pt. 1",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/Manual-del-Formador-1-1.pdf",
              },
              {
                codigo: "N1.2",
                nombre: "Primer ciclo pt. 2",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/Manual-del-Formador-1-2.pdf",
              },
              {
                codigo: "N2",
                nombre: "Segundo ciclo",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/Manual-del-Formador-2.pdf",
              },
              {
                codigo: "N3",
                nombre: "Tercer ciclo",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/Manual-del-Formador-3.pdf",
              },
            ],
          },
        ];
        break;

      case "Edición Senior":
        this.material = [
          {
            nombreSeccion: "Material",
            archivos: [
              {
                codigo: "S-BD-C-CC",
                nombre: "Banca Digital",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/Senior.-Banca-Digital-feb-2025.pdf",
              },
              {
                codigo: "S-BD-C-CC",
                nombre: "Cajeros y correos cash",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/Guia-Cajeros-y-Correos-Cash-feb-2025-002.pdf",
              },
              {
                codigo: "S-CIBER",
                nombre: "Ciberseguridad",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/2023/06/Senior.-Ciberseguridad.pdf",
              },
            ],
          },
          {
            nombreSeccion: "Guías para el usuario",
            archivos: [
              {
                codigo: "S-BD-C-CC",
                nombre: "G. Banca Digital",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/2023/06/Guia-App-1.pdf",
              },
              {
                codigo: "S-BD-C-CC",
                nombre: "G. Cajeros y correos cash",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/2023/06/Guia-Cajeros-y-cash-1.pdf",
              },
              {
                codigo: "S-CIBER",
                nombre: "G. Ciberseguridad",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/2023/06/Guia-Ciberseguridad-1.pdf",
              },
            ],
          },
        ];
        break;

      case "Justicia Educativa":
        this.material = [
          {
            nombreSeccion: "Material",
            archivos: [
              {
                codigo: "JE",
                nombre: "Justicia educativa con vídeos enlazados",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/Justicia-educativa-videos-enlazados-v032025.pdf",
              },
              {
                codigo: "JE",
                nombre: "Justicia educativa con vídeos incrustrados",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/Justicia-educativa-en-ppt-videos-incrustados-v032025-1.pptx",
              },
            ],
          },
        ];
        break;

      case "Edición Inclusiva":
        this.material = [
          {
            nombreSeccion: "Material",
            archivos: [
              {
                codigo: "FxMI1",
                nombre: "Sesión 1: Finanzas fáciles de comprender",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/Proyecto-Inclusion-Sesion-1-v3-Con-Sello-1.pdf",
              },
              {
                codigo: "FxMI2",
                nombre: "Sesión 2: Finanzas fáciles de comprender",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/Proyecto-Inclusion-Sesion-2-v2-Sello-1.pdf",
              },
            ],
          },
          {
            nombreSeccion: "Manual para el formador",
            archivos: [
              {
                codigo: "FxMI1",
                nombre: "Sesión 1: Finanzas fáciles de comprender",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/Proyecto-Inclusion-Sesion-1-v2-Manual-del-Formador-Sello-1.pdf",
              },
              {
                codigo: "FxMI2",
                nombre: "Sesión 2: Finanzas fáciles de comprender",
                icono: "description",
                url: "https://finanzasparamortales.es/wp-content/uploads/Proyecto-Inclusion-Sesion-2-v2-Manual-del-Formador-Sello-1.pdf",
              },
            ],
          },
          {
            nombreSeccion: "Guías para el usuario",
            archivos: [
              {
                codigo: "FxMI",
                nombre: "Guía de finanzas en lectura fácil",
                icono: "description",
                url: "https://acrobat.adobe.com/id/urn:aaid:sc:US:711b3d30-c379-47e0-9480-9be74ad0eb38",
              },
            ],
          },
        ];
        break;
    } //Fin Switch
  }
}
