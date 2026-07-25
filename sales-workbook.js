const textEncoder = new TextEncoder();

const CRC32_TABLE = (() => {
    const table = new Uint32Array(256);

    for (let index = 0; index < 256; index += 1) {
        let value = index;

        for (let bit = 0; bit < 8; bit += 1) {
            value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
        }

        table[index] = value >>> 0;
    }

    return table;
})();

function escapeXml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
}

function crc32(bytes) {
    let value = 0xffffffff;

    bytes.forEach(function (byte) {
        value = CRC32_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
    });

    return (value ^ 0xffffffff) >>> 0;
}

function writeUint16(target, offset, value) {
    target[offset] = value & 0xff;
    target[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32(target, offset, value) {
    target[offset] = value & 0xff;
    target[offset + 1] = (value >>> 8) & 0xff;
    target[offset + 2] = (value >>> 16) & 0xff;
    target[offset + 3] = (value >>> 24) & 0xff;
}

function dosDateTime(date) {
    const safeDate = date instanceof Date && !Number.isNaN(date.valueOf()) ? date : new Date();
    const year = Math.max(1980, safeDate.getFullYear());

    return {
        date: ((year - 1980) << 9) | ((safeDate.getMonth() + 1) << 5) | safeDate.getDate(),
        time: (safeDate.getHours() << 11) | (safeDate.getMinutes() << 5) |
            Math.floor(safeDate.getSeconds() / 2)
    };
}

function createZip(files) {
    const timestamp = dosDateTime(new Date());
    const localParts = [];
    const centralParts = [];
    let localOffset = 0;

    files.forEach(function (file) {
        const nameBytes = textEncoder.encode(file.name);
        const dataBytes = typeof file.content === "string"
            ? textEncoder.encode(file.content)
            : file.content;
        const checksum = crc32(dataBytes);
        const localHeader = new Uint8Array(30 + nameBytes.length);

        writeUint32(localHeader, 0, 0x04034b50);
        writeUint16(localHeader, 4, 20);
        writeUint16(localHeader, 6, 0);
        writeUint16(localHeader, 8, 0);
        writeUint16(localHeader, 10, timestamp.time);
        writeUint16(localHeader, 12, timestamp.date);
        writeUint32(localHeader, 14, checksum);
        writeUint32(localHeader, 18, dataBytes.length);
        writeUint32(localHeader, 22, dataBytes.length);
        writeUint16(localHeader, 26, nameBytes.length);
        writeUint16(localHeader, 28, 0);
        localHeader.set(nameBytes, 30);

        const centralHeader = new Uint8Array(46 + nameBytes.length);

        writeUint32(centralHeader, 0, 0x02014b50);
        writeUint16(centralHeader, 4, 20);
        writeUint16(centralHeader, 6, 20);
        writeUint16(centralHeader, 8, 0);
        writeUint16(centralHeader, 10, 0);
        writeUint16(centralHeader, 12, timestamp.time);
        writeUint16(centralHeader, 14, timestamp.date);
        writeUint32(centralHeader, 16, checksum);
        writeUint32(centralHeader, 20, dataBytes.length);
        writeUint32(centralHeader, 24, dataBytes.length);
        writeUint16(centralHeader, 28, nameBytes.length);
        writeUint16(centralHeader, 30, 0);
        writeUint16(centralHeader, 32, 0);
        writeUint16(centralHeader, 34, 0);
        writeUint16(centralHeader, 36, 0);
        writeUint32(centralHeader, 38, 0);
        writeUint32(centralHeader, 42, localOffset);
        centralHeader.set(nameBytes, 46);

        localParts.push(localHeader, dataBytes);
        centralParts.push(centralHeader);
        localOffset += localHeader.length + dataBytes.length;
    });

    const centralSize = centralParts.reduce(function (total, part) {
        return total + part.length;
    }, 0);
    const endRecord = new Uint8Array(22);

    writeUint32(endRecord, 0, 0x06054b50);
    writeUint16(endRecord, 4, 0);
    writeUint16(endRecord, 6, 0);
    writeUint16(endRecord, 8, files.length);
    writeUint16(endRecord, 10, files.length);
    writeUint32(endRecord, 12, centralSize);
    writeUint32(endRecord, 16, localOffset);
    writeUint16(endRecord, 20, 0);

    const parts = [...localParts, ...centralParts, endRecord];
    const totalLength = parts.reduce(function (total, part) {
        return total + part.length;
    }, 0);
    const output = new Uint8Array(totalLength);
    let offset = 0;

    parts.forEach(function (part) {
        output.set(part, offset);
        offset += part.length;
    });

    return output;
}

function excelDateSerial(value) {
    if (!value) {
        return null;
    }

    const normalized = typeof value === "string" && /^\d{4}-\d{2}-\d{2} /.test(value)
        ? value.replace(" ", "T") + "Z"
        : value;
    const date = new Date(normalized);

    if (Number.isNaN(date.valueOf())) {
        return null;
    }

    return (date.valueOf() / 86400000) + 25569;
}

function columnName(index) {
    let value = index;
    let name = "";

    while (value > 0) {
        const remainder = (value - 1) % 26;
        name = String.fromCharCode(65 + remainder) + name;
        value = Math.floor((value - 1) / 26);
    }

    return name;
}

function textCell(reference, value, style = 0) {
    const styleAttribute = style ? ` s="${style}"` : "";
    return `<c r="${reference}" t="inlineStr"${styleAttribute}><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function numberCell(reference, value, style = 0) {
    const styleAttribute = style ? ` s="${style}"` : "";
    return `<c r="${reference}"${styleAttribute}><v>${Number(value) || 0}</v></c>`;
}

function blankCell(reference, style = 0) {
    const styleAttribute = style ? ` s="${style}"` : "";
    return `<c r="${reference}"${styleAttribute}/>`;
}

function formulaCell(reference, formula, cachedValue, style = 0) {
    const styleAttribute = style ? ` s="${style}"` : "";
    return `<c r="${reference}"${styleAttribute}><f>${escapeXml(formula)}</f><v>${Number(cachedValue) || 0}</v></c>`;
}

function rowXml(rowNumber, cells, height) {
    const heightAttributes = height
        ? ` ht="${height}" customHeight="1"`
        : "";
    return `<row r="${rowNumber}"${heightAttributes}>${cells.join("")}</row>`;
}

function worksheetXml(options) {
    const columnXml = options.widths.map(function (width, index) {
        const number = index + 1;
        return `<col min="${number}" max="${number}" width="${width}" customWidth="1"/>`;
    }).join("");
    const paneXml = options.freezeRows
        ? `<pane ySplit="${options.freezeRows}" topLeftCell="A${options.freezeRows + 1}" activePane="bottomLeft" state="frozen"/>`
        : "";
    const autoFilterXml = options.autoFilter
        ? `<autoFilter ref="${options.autoFilter}"/>`
        : "";
    const mergeXml = options.merges && options.merges.length
        ? `<mergeCells count="${options.merges.length}">${options.merges.map(function (range) {
            return `<mergeCell ref="${range}"/>`;
        }).join("")}</mergeCells>`
        : "";

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
    <dimension ref="${options.dimension}"/>
    <sheetViews><sheetView workbookViewId="0" showGridLines="${options.showGridLines === false ? "0" : "1"}">${paneXml}</sheetView></sheetViews>
    <sheetFormatPr defaultRowHeight="15"/>
    <cols>${columnXml}</cols>
    <sheetData>${options.rows.join("")}</sheetData>
    ${autoFilterXml}
    ${mergeXml}
    <pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.2" footer="0.2"/>
</worksheet>`;
}

function buildSummarySheet(data) {
    const productSales = data.sales.reduce(function (total, line) {
        return total + (Number(line.lineTotalCents) || 0);
    }, 0) / 100;
    const donationsReceived = data.donations.reduce(function (total, donation) {
        return donation.status === "received"
            ? total + (Number(donation.amountCents) || 0)
            : total;
    }, 0) / 100;
    const totalIncome = productSales + donationsReceived;
    const rows = [
        rowXml(1, [textCell("A1", "Soda Backyard Garden — Finance Tracker", 4)], 30),
        rowXml(2, [
            textCell("A2", "Exported"),
            textCell("B2", data.exportedAt || new Date().toISOString())
        ]),
        rowXml(4, [
            textCell("A4", "Financial Summary", 1),
            textCell("B4", "Amount", 1)
        ], 22),
        rowXml(5, [
            textCell("A5", "Product sales", 5),
            formulaCell("B5", "SUM(Sales!G2:G5001)", productSales, 6)
        ], 24),
        rowXml(6, [
            textCell("A6", "Donations received", 5),
            formulaCell("B6", 'SUMIFS(Donations!D2:D5001,Donations!E2:E5001,"Received")', donationsReceived, 6)
        ], 24),
        rowXml(7, [
            textCell("A7", "Total income", 5),
            formulaCell("B7", "SUM(B5:B6)", totalIncome, 6)
        ], 24),
        rowXml(8, [
            textCell("A8", "Expenses", 5),
            formulaCell("B8", "SUM(Expenses!E2:E1001)", 0, 6)
        ], 24),
        rowXml(9, [
            textCell("A9", "Net profit", 7),
            formulaCell("B9", "B7-B8", totalIncome, 8)
        ], 27),
        rowXml(11, [
            textCell(
                "A11",
                "Enter garden costs on the Expenses sheet. The totals above update automatically in Excel. Download a fresh workbook whenever you want the latest confirmed website sales and donation records.",
                9
            )
        ], 48)
    ];

    return worksheetXml({
        widths: [29, 20, 15, 15],
        dimension: "A1:D13",
        rows,
        merges: ["A1:D1", "A11:D13"],
        showGridLines: false
    });
}

function buildSalesSheet(data) {
    const headers = [
        "Date Received", "Order Number", "Customer", "Product",
        "Quantity", "Unit Price", "Revenue", "Order Source"
    ];
    const rows = [
        rowXml(1, headers.map(function (header, index) {
            return textCell(columnName(index + 1) + "1", header, 1);
        }), 24)
    ];

    data.sales.forEach(function (line, index) {
        const rowNumber = index + 2;
        const dateSerial = excelDateSerial(line.paidAt);
        rows.push(rowXml(rowNumber, [
            dateSerial === null
                ? textCell("A" + rowNumber, line.paidAt || "")
                : numberCell("A" + rowNumber, dateSerial, 3),
            textCell("B" + rowNumber, line.orderNumber),
            textCell("C" + rowNumber, line.customerName),
            textCell("D" + rowNumber, line.productName),
            numberCell("E" + rowNumber, line.quantity, 10),
            numberCell("F" + rowNumber, (Number(line.unitPriceCents) || 0) / 100, 2),
            numberCell("G" + rowNumber, (Number(line.lineTotalCents) || 0) / 100, 2),
            textCell("H" + rowNumber, line.source || "online")
        ]));
    });

    return worksheetXml({
        widths: [20, 23, 24, 31, 12, 15, 15, 16],
        dimension: `A1:H${Math.max(1, data.sales.length + 1)}`,
        rows,
        freezeRows: 1,
        autoFilter: `A1:H${Math.max(1, data.sales.length + 1)}`
    });
}

function buildDonationsSheet(data) {
    const headers = ["Date", "Reference", "Donor", "Amount", "Status", "Notes"];
    const rows = [
        rowXml(1, headers.map(function (header, index) {
            return textCell(columnName(index + 1) + "1", header, 1);
        }), 24)
    ];

    data.donations.forEach(function (donation, index) {
        const rowNumber = index + 2;
        const dateValue = donation.status === "received"
            ? donation.receivedAt
            : donation.createdAt;
        const dateSerial = excelDateSerial(dateValue);
        const status = donation.status === "received" ? "Received" : "Pending";
        rows.push(rowXml(rowNumber, [
            dateSerial === null
                ? textCell("A" + rowNumber, dateValue || "")
                : numberCell("A" + rowNumber, dateSerial, 12),
            textCell("B" + rowNumber, donation.referenceNumber || "Manual entry"),
            textCell("C" + rowNumber, donation.donorName),
            numberCell("D" + rowNumber, (Number(donation.amountCents) || 0) / 100, 2),
            textCell("E" + rowNumber, status),
            textCell("F" + rowNumber, donation.note || "")
        ]));
    });

    return worksheetXml({
        widths: [16, 24, 25, 15, 14, 42],
        dimension: `A1:F${Math.max(1, data.donations.length + 1)}`,
        rows,
        freezeRows: 1,
        autoFilter: `A1:F${Math.max(1, data.donations.length + 1)}`
    });
}

function buildExpensesSheet() {
    const headers = ["Date", "Category", "Vendor / Paid To", "Description", "Amount", "Receipt / Notes"];
    const rows = [
        rowXml(1, headers.map(function (header, index) {
            return textCell(columnName(index + 1) + "1", header, 1);
        }), 24)
    ];

    for (let rowNumber = 2; rowNumber <= 251; rowNumber += 1) {
        rows.push(rowXml(rowNumber, [
            blankCell("A" + rowNumber, 12),
            blankCell("B" + rowNumber, 11),
            blankCell("C" + rowNumber, 11),
            blankCell("D" + rowNumber, 11),
            blankCell("E" + rowNumber, 2),
            blankCell("F" + rowNumber, 11)
        ]));
    }

    return worksheetXml({
        widths: [16, 20, 25, 36, 15, 38],
        dimension: "A1:F251",
        rows,
        freezeRows: 1,
        autoFilter: "A1:F251"
    });
}

function stylesXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
    <numFmts count="3">
        <numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00;[Red](&quot;$&quot;#,##0.00);-"/>
        <numFmt numFmtId="165" formatCode="yyyy-mm-dd hh:mm"/>
        <numFmt numFmtId="166" formatCode="yyyy-mm-dd"/>
    </numFmts>
    <fonts count="5">
        <font><sz val="11"/><name val="Aptos"/></font>
        <font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font>
        <font><b/><color rgb="FFFFFFFF"/><sz val="18"/><name val="Aptos Display"/></font>
        <font><b/><color rgb="FF14532D"/><sz val="12"/><name val="Aptos"/></font>
        <font><color rgb="FF596B5D"/><sz val="10"/><name val="Aptos"/></font>
    </fonts>
    <fills count="6">
        <fill><patternFill patternType="none"/></fill>
        <fill><patternFill patternType="gray125"/></fill>
        <fill><patternFill patternType="solid"><fgColor rgb="FF285936"/><bgColor indexed="64"/></patternFill></fill>
        <fill><patternFill patternType="solid"><fgColor rgb="FFEEF6ED"/><bgColor indexed="64"/></patternFill></fill>
        <fill><patternFill patternType="solid"><fgColor rgb="FFDDEEDD"/><bgColor indexed="64"/></patternFill></fill>
        <fill><patternFill patternType="solid"><fgColor rgb="FFFFF4D6"/><bgColor indexed="64"/></patternFill></fill>
    </fills>
    <borders count="2">
        <border><left/><right/><top/><bottom/><diagonal/></border>
        <border>
            <left style="thin"><color rgb="FFDCE8DC"/></left>
            <right style="thin"><color rgb="FFDCE8DC"/></right>
            <top style="thin"><color rgb="FFDCE8DC"/></top>
            <bottom style="thin"><color rgb="FFDCE8DC"/></bottom>
            <diagonal/>
        </border>
    </borders>
    <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
    <cellXfs count="13">
        <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
        <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0"><alignment vertical="center"/></xf>
        <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
        <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
        <xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0"><alignment vertical="center"/></xf>
        <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0"><alignment vertical="center"/></xf>
        <xf numFmtId="164" fontId="3" fillId="3" borderId="1" xfId="0" applyNumberFormat="1"><alignment vertical="center"/></xf>
        <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0"><alignment vertical="center"/></xf>
        <xf numFmtId="164" fontId="3" fillId="4" borderId="1" xfId="0" applyNumberFormat="1"><alignment vertical="center"/></xf>
        <xf numFmtId="0" fontId="4" fillId="5" borderId="1" xfId="0"><alignment wrapText="1" vertical="center"/></xf>
        <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment horizontal="center"/></xf>
        <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"><alignment vertical="center"/></xf>
        <xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    </cellXfs>
    <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
    <dxfs count="0"/>
    <tableStyles count="0" defaultTableStyle="TableStyleMedium4" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`;
}

export function buildSalesWorkbook(data = {}) {
    const normalized = {
        exportedAt: data.exportedAt || new Date().toISOString(),
        sales: Array.isArray(data.sales) ? data.sales : [],
        donations: Array.isArray(data.donations) ? data.donations : []
    };
    const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
    <bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="15000"/></bookViews>
    <sheets>
        <sheet name="Summary" sheetId="1" r:id="rId1"/>
        <sheet name="Sales" sheetId="2" r:id="rId2"/>
        <sheet name="Donations" sheetId="3" r:id="rId3"/>
        <sheet name="Expenses" sheetId="4" r:id="rId4"/>
    </sheets>
    <calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/>
</workbook>`;
    const files = [
        {
            name: "[Content_Types].xml",
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
    <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
    <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
    <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
    <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
    <Override PartName="/xl/worksheets/sheet4.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`
        },
        {
            name: "_rels/.rels",
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
        },
        {
            name: "xl/workbook.xml",
            content: workbookXml
        },
        {
            name: "xl/_rels/workbook.xml.rels",
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
    <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
    <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
    <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet4.xml"/>
    <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
        },
        {
            name: "xl/styles.xml",
            content: stylesXml()
        },
        {
            name: "xl/worksheets/sheet1.xml",
            content: buildSummarySheet(normalized)
        },
        {
            name: "xl/worksheets/sheet2.xml",
            content: buildSalesSheet(normalized)
        },
        {
            name: "xl/worksheets/sheet3.xml",
            content: buildDonationsSheet(normalized)
        },
        {
            name: "xl/worksheets/sheet4.xml",
            content: buildExpensesSheet()
        }
    ];

    return createZip(files);
}
