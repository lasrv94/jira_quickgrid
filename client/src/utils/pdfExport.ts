import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AppConfig, CustomColumn, JiraIssue } from '../types';
import type { Language } from './i18n';

import { evaluateFormula } from './formulaEvaluator';

interface ExportPdfOptions {
  issues: JiraIssue[];
  columns: CustomColumn[];
  groupBy: string | null;
  config: AppConfig | null;
  filterName?: string;
  lang?: Language;
}

export function exportIssuesToPdf({
  issues,
  columns,
  groupBy,
  config,
  filterName,
  lang = 'es',
}: ExportPdfOptions) {
  // Use landscape A4 for optimal data grid readability
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const isEs = lang === 'es';
  const now = new Date();
  const dateFormatted = now.toLocaleDateString(isEs ? 'es-MX' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const domain = config?.jira_domain || 'Jira Cloud';
  const filterLabel = filterName || config?.selected_filter_name || (isEs ? 'Todos los proyectos' : 'All projects');

  // --- HEADER SECTION ---
  // Slate banner top line
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(0, 0, 297, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(
    isEs ? 'JIRA QUICKGRID — REPORTE EJECUTIVO DE INCIDENCIAS' : 'JIRA QUICKGRID — EXECUTIVE ISSUE REPORT',
    14,
    11
  );

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // Slate-300
  doc.text(
    `${isEs ? 'Fecha de emisión' : 'Generated'}: ${dateFormatted}   |   ${isEs ? 'Instancia' : 'Instance'}: ${domain}   |   ${isEs ? 'Filtro' : 'Filter'}: ${filterLabel}`,
    14,
    18
  );

  // --- EXECUTIVE SUMMARY METRICS ---
  let startY = 32;

  const total = issues.length;
  const doneCount = issues.filter(
    (i) => i.jira_status_category?.toLowerCase() === 'done' || i.jira_status?.toLowerCase().includes('done')
  ).length;
  const inProgressCount = issues.filter(
    (i) => i.jira_status_category?.toLowerCase() === 'in progress' || i.jira_status?.toLowerCase().includes('progress')
  ).length;
  const todoCount = total - doneCount - inProgressCount;

  // Stat Boxes
  const statBox = (x: number, y: number, w: number, h: number, title: string, value: string | number, color: [number, number, number]) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, w, h, 2, 2, 'FD');

    // Colored accent left border
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(x, y, 2.5, h, 'F');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(title.toUpperCase(), x + 6, y + 6);

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(String(value), x + 6, y + 13);
  };

  const boxW = 64;
  statBox(14, startY, boxW, 16, isEs ? 'Total Tickets' : 'Total Issues', total, [59, 130, 246]);
  statBox(14 + boxW + 6, startY, boxW, 16, isEs ? 'En Progreso' : 'In Progress', inProgressCount, [147, 51, 234]);
  statBox(14 + (boxW + 6) * 2, startY, boxW, 16, isEs ? 'Completados' : 'Done', doneCount, [16, 185, 129]);
  statBox(14 + (boxW + 6) * 3, startY, boxW, 16, isEs ? 'Por Hacer / To Do' : 'To Do', Math.max(0, todoCount), [245, 158, 11]);

  startY += 24;

  // Visible custom columns
  const visibleCols = columns.filter((c) => c.is_visible).slice(0, 4); // Limit to top 4 to avoid horizontal overflow

  // Helper to format custom column values for PDF
  const getCustomValueText = (issue: JiraIssue, col: CustomColumn): string => {
    if (col.type === 'jira_field' || col.jira_field_key) {
      const fieldKey = col.jira_field_key || col.id;
      const rawVal = issue.raw_jira_fields?.[fieldKey];
      if (rawVal === null || rawVal === undefined) return '-';
      if (Array.isArray(rawVal)) {
        return rawVal.map((v) => (typeof v === 'object' ? v.name || v.value || '' : String(v))).join(', ');
      }
      if (typeof rawVal === 'object') return rawVal.displayName || rawVal.name || rawVal.value || '-';
      return String(rawVal);
    }
    if (col.type === 'formula') {
      const res = evaluateFormula(col.formula, issue, columns);
      if (res === null || res === undefined || res === '') return '-';
      return String(res);
    }
    const val = issue.custom_values?.[col.id];
    if (val === null || val === undefined || val === '') return '-';
    if (col.type === 'single_select') {
      const opt = col.options?.find((o) => o.id === val);
      return opt ? opt.label : String(val);
    }
    return String(val);
  };

  // Build Table Headers
  const tableHeaders = [
    '#',
    isEs ? 'Clave' : 'Key',
    isEs ? 'Resumen / Summary' : 'Summary',
    isEs ? 'Estado' : 'Status',
    isEs ? 'Prioridad' : 'Priority',
    isEs ? 'Asignado' : 'Assignee',
    ...visibleCols.map((c) => c.name),
  ];

  // Grouping logic for PDF
  interface GroupedSection {
    label: string;
    items: JiraIssue[];
  }

  const groups: GroupedSection[] = [];

  if (!groupBy) {
    groups.push({
      label: isEs ? 'Todas las Incidencias' : 'All Issues',
      items: issues,
    });
  } else {
    const map: Record<string, JiraIssue[]> = {};
    issues.forEach((issue) => {
      let key = '';
      if (groupBy === 'jira_status') key = issue.jira_status || (isEs ? 'Sin Estado' : 'No Status');
      else if (groupBy === 'priority') key = issue.priority || (isEs ? 'Sin Prioridad' : 'No Priority');
      else if (groupBy === 'assignee_name') key = issue.assignee_name || (isEs ? 'Sin Asignar' : 'Unassigned');
      else {
        const customCol = columns.find((c) => c.id === groupBy);
        const rawVal = issue.custom_values?.[groupBy];
        if (customCol && customCol.type === 'single_select') {
          const opt = customCol.options?.find((o) => o.id === rawVal);
          key = opt ? opt.label : isEs ? 'Sin Definir' : 'Undefined';
        } else {
          key = rawVal ? String(rawVal) : isEs ? 'Sin Definir' : 'Undefined';
        }
      }
      if (!map[key]) map[key] = [];
      map[key].push(issue);
    });

    Object.entries(map).forEach(([label, items]) => {
      groups.push({ label, items });
    });
  }

  // Render Table for each group
  let currentY = startY;

  groups.forEach((group) => {
    // If not first group and near bottom, start a new page
    if (currentY > 165) {
      doc.addPage();
      currentY = 20;
    }

    // Group Header Title
    doc.setFillColor(241, 245, 249); // Slate-100
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, currentY, 269, 7.5, 1, 1, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(
      `📁  ${group.label.toUpperCase()} (${group.items.length} ${
        group.items.length === 1 ? (isEs ? 'ticket' : 'issue') : isEs ? 'tickets' : 'issues'
      })`,
      17,
      currentY + 5.2
    );

    currentY += 9;

    const bodyRows = group.items.map((issue, idx) => [
      String(idx + 1),
      issue.key,
      issue.summary.length > 55 ? `${issue.summary.slice(0, 52)}...` : issue.summary,
      issue.jira_status || '-',
      issue.priority || '-',
      issue.assignee_name || (isEs ? 'Sin asignar' : 'Unassigned'),
      ...visibleCols.map((c) => getCustomValueText(issue, c)),
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [tableHeaders],
      body: bodyRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'left',
        cellPadding: 2.2,
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
        valign: 'middle',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' }, // #
        1: { cellWidth: 22, fontStyle: 'bold', textColor: [37, 99, 235] }, // Key
        2: { cellWidth: 'auto' }, // Summary
        3: { cellWidth: 26 }, // Status
        4: { cellWidth: 22 }, // Priority
        5: { cellWidth: 32 }, // Assignee
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        // Footer with page number
        const pageCount = (doc as any).internal.getNumberOfPages();
        const pageCurrent = (data as any).pageNumber;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184); // Slate-400
        doc.text(
          `${isEs ? 'Reporte generado por Jira QuickGrid' : 'Report generated by Jira QuickGrid'}   |   ${isEs ? 'Página' : 'Page'} ${pageCurrent} / ${pageCount}`,
          14,
          204
        );
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY;
    currentY = (finalY || currentY) + 7;
  });

  // Save the PDF
  const dateStr = now.toISOString().slice(0, 10);
  const fileName = `Jira_Executive_Report_${dateStr}.pdf`;
  doc.save(fileName);
}
