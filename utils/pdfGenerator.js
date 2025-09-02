const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const logger = require("../config/logger");
const { uploadPDFToCloudinary } = require("./cloudinaryUpload");
const { updatePayslipData } = require("./sheet");
const { sendPayslipEmail } = require("./sendEmail");

// Cache template bytes so we don’t read from disk repeatedly
let cachedTemplateBytes = null;

async function generatePayslip(employee, outputPath) {
    if (!cachedTemplateBytes) {
        const templatePath = path.join(
            __dirname,
            "Payslip_-_Jan'25_-_Template.PDF"
        );
        cachedTemplateBytes = fs.readFileSync(templatePath);
    }

    const pdfDoc = await PDFDocument.load(cachedTemplateBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const page = pdfDoc.getPage(0);

    // Get page dimensions
    const { width, height } = page.getSize();

    const draw = (
        text,
        x,
        y,
        size = 9,
        fontType = font,
        color = rgb(0, 0, 0),
        align = "left"
    ) => {
        if (!text || text === "") return; // Don't draw empty text

        let adjustedX = x;

        // Handle right alignment for monetary values
        if (align === "right") {
            const textWidth = fontType.widthOfTextAtSize(String(text), size);
            adjustedX = x - textWidth;
        }

        page.drawText(String(text), {
            x: adjustedX,
            y: height - y,
            size,
            font: fontType,
            color,
        });
    };

    // Replace the month/year in the header - positioned after "Salary Slip for "
    const month = employee["Month"] || "January - 2025";
    draw(month, 313, 172, 9);

    // Employee Details Section - Row 1 (KEEPING EXACT POSITIONS AS PROVIDED)
    // Employee Name | Employee Type | Employee Code
    draw(employee["Employee Name"] || "", 130, 206, 9, boldFont);
    draw(employee["Employee Type"] || "", 382, 206, 9, boldFont);
    draw(employee["Employee Code"] || "", 526, 206, 9, boldFont);

    // Row 2: Designation | Department | No. of Days in Month
    draw(employee["Designation"] || "", 108, 227, 9, boldFont);
    draw(employee["Department"] || "", 108, 248, 9, boldFont);

    // Calculate total days in month based on the employee's month
    const getDaysInMonth = (monthStr) => {
        const monthYear = monthStr.split("-").map((part) => part.trim());
        const month = monthYear[0].toLowerCase();
        const year = parseInt(monthYear[1]) || new Date().getFullYear();

        const monthMap = {
            "january": 0,
            "february": 1,
            "march": 2,
            "april": 3,
            "may": 4,
            "june": 5,
            "july": 6,
            "august": 7,
            "september": 8,
            "october": 9,
            "november": 10,
            "december": 11,
        };

        const monthIndex = monthMap[month];
        return new Date(year, monthIndex + 1, 0).getDate();
    };

    // Replace the existing totalDaysInMonth calculation with:
    const totalDaysInMonth = getDaysInMonth(employee["Month"]);
    draw(totalDaysInMonth.toString(), 405, 248, 9, boldFont);

    // Row 3: Date of Joining | Working Days
    draw(employee["Date of Joining"] || "", 124, 272, 9, boldFont);
    draw(employee["Working Days"] || "", 377, 271, 9, boldFont);

    // Row 4: Provident Fund | ESIC No
    draw(employee["Provident Fund"] || "", 123, 293, 9, boldFont);
    draw(employee["ESIC No."] || "", 360, 293, 9, boldFont);

    // Row 5: Total Arrear Days | LOP
    draw(employee["Total Arrear Days"] || "", 392, 315, 9, boldFont);
    draw(employee["LOP"] || "", 481, 315, 9, boldFont);

    // Bank Details Section - adjusting based on employee details positioning
    // Row 1: Bank Name | Account No | IFSC Code | Branch Name
    draw(employee["Bank Name"] || "", 106, 336, 9, boldFont);
    draw(employee["Account No"] || "", 240, 336, 9, boldFont);
    draw(employee["IFSC Code"] || "", 368, 336, 9, boldFont);
    draw(employee["Branch Name"] || "", 518, 336, 9, boldFont);

    // Row 2: UAN No | PAN No
    draw(employee["UAN No"] || "NA", 96, 357, 9, boldFont);
    draw(employee["PAN No"] || "", 354, 357, 9, boldFont);

    // Earnings Section - Amount column (right-aligned in the Amount (Rs.) column)
    const earningsAmountColumnX = 305; // Adjusted X position for the Earnings Amount (Rs.) column

    // Basic Salary
    draw(
        employee["Basic Salary"] || "0",
        earningsAmountColumnX,
        423,
        9,
        font,
        rgb(0, 0, 0),
        "right"
    );

    // HRA (Hour Rent Allowance)
    draw(
        employee["HRA"] || "0",
        earningsAmountColumnX,
        446,
        9,
        font,
        rgb(0, 0, 0),
        "right"
    );

    // LTA Allowance
    draw(
        employee["LTA"] || "0",
        earningsAmountColumnX,
        469,
        9,
        font,
        rgb(0, 0, 0),
        "right"
    );

    // Special Allowance
    draw(
        employee["Special Allowance"] || "0",
        earningsAmountColumnX,
        492,
        9,
        font,
        rgb(0, 0, 0),
        "right"
    );

    // Gross Earning (bold) - positioned at the Gross Earning row
    draw(
        employee["Gross Earning"] || "0",
        earningsAmountColumnX,
        516,
        9,
        boldFont,
        rgb(0, 0, 0),
        "right"
    );

    // Deductions Section - Amount column (right-aligned)
    const deductionAmountColumnX = 575; // Adjusted X position for deductions Amount (Rs.) column

    // Professional Tax
    draw(
        employee["Professional Tax"] || "0",
        deductionAmountColumnX,
        423,
        9,
        font,
        rgb(0, 0, 0),
        "right"
    );

    // TDS
    draw(
        employee["TDS"] || "0",
        deductionAmountColumnX,
        446,
        9,
        font,
        rgb(0, 0, 0),
        "right"
    );

    // Total Deductions (bold)
    draw(
        employee["Total Deductions"] || "0",
        deductionAmountColumnX,
        516,
        9,
        boldFont,
        rgb(0, 0, 0),
        "right"
    );

    // Net Pay section (left side - larger font, bold)
    draw(
        employee["Net Pay"] || "0",
        earningsAmountColumnX,
        562,
        9,
        boldFont,
        rgb(0, 0, 0),
        "right"
    );

    // Total Pay (right side - same as Net Pay for this template)
    draw(
        employee["Net Pay"] || "0", // Using Net Pay as Total Pay since they should be the same
        earningsAmountColumnX,
        539,
        9,
        boldFont,
        rgb(0, 0, 0),
        "right"
    );

    // Net Pay in words - positioned in the designated text area
    const netPayWords = employee["Net Pay (Words)"] || "";
    if (netPayWords) {
        // Extract just the amount part (without "Rupees Only.")
        const amountWords = netPayWords.replace(/\s*Rupees\s*Only\.?\s*$/i, "");
        draw(amountWords, 338, 562, 9, boldFont);
        draw("Rupees Only.", 515, 572, 9, boldFont);
    }

    // Generation date (bottom of page)
    const generatedDate = new Date()
        .toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
        })
        .replace(/,/g, "");
    draw(`${generatedDate}`, 525, 606, 9);

    // Save PDF
    const pdfBytes = await pdfDoc.save();

    if (outputPath) {
        // fs.writeFileSync(outputPath, pdfBytes);
        console.log(`Payslip saved to: ${outputPath}`);
    }

    return pdfBytes;
}

async function generateAllPayslips(data, sheetId, selectedMonth) {
    const { default: pLimit } = await import("p-limit");
    const payslips = data;
    // Get the month from the first employee
    const monthLabel = payslips[0]?.Month || "Payslips";

    // Create local output folder
    const outputDir = path.join(
        __dirname,
        "output",
        monthLabel.replace(/\s+/g, "_")
    );
    if (!fs.existsSync(outputDir)) {
        // fs.mkdirSync(outputDir, { recursive: true });
    }

    const limit = pLimit(5); // process 5 at a time

    const payslipUpdates = {};
    const today = new Date();
    const generatedDate = today
        .toLocaleDateString("en-GB")
        .replace(/\//g, "/");

    await Promise.all(
        payslips.map((emp) =>
            limit(async () => {
                try {
                    const fileName = `${emp["Employee Code"]}_Payslip.pdf`;
                    const localFilePath = path.join(outputDir, fileName);

                    // 1️⃣ Generate PDF (returns buffer + saves locally)
                    const pdfBuffer = await generatePayslip(emp, localFilePath);

                    // 2️⃣ Upload to Cloudinary
                    const folderPath = `Payslips/${monthLabel.replace(/\s+/g, "_")}`;
                    const uploadResult = await uploadPDFToCloudinary(
                        pdfBuffer,
                        fileName,
                        folderPath
                    );
                    logger.info(`📤 Uploaded: ${uploadResult.secure_url}`);

                    // Email
                    let emailSent = false;
                    if (emp["Email"]) {
                        await sendPayslipEmail(emp, pdfBuffer);
                        emailSent = true;
                        logger.info(`📧 Payslip emailed to ${emp["Email"]}`);
                    } else {
                        logger.warn(`⚠️ No email for ${emp["Employee Name"]}`);
                    }

                    // Store updates
                    payslipUpdates[emp["Employee Code"]] = {
                        link: uploadResult.secure_url,
                        generatedDate,
                        emailSent,
                    };
                } catch (error) {
                    logger.error(`❌ Failed for ${emp["Employee Name"]}: ${error.message}`);
                }
            })
        )
    );

    // 4️⃣ Update Google Sheet
    await updatePayslipData(sheetId, selectedMonth, payslipUpdates);

    logger.info(`✅ All payslips processed for ${monthLabel}`);
}

module.exports = { generateAllPayslips, generatePayslip };
