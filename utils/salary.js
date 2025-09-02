const moment = require("moment");

const calculateWorkingDays = (monthYear) => {
    // Expected input format: "MM/YYYY" or "M/YYYY"
    const [month, year] = monthYear.split("/");
    if (!month || !year) {
        throw new Error(
            'Invalid format. Please provide input as "MM/YYYY" or "M/YYYY"'
        );
    }

    // Pad month to ensure two digits
    const paddedMonth = month.toString().padStart(2, "0");
    const dateString = `${year}-${paddedMonth}-01`;
    const date = moment(dateString, moment.ISO_8601, true); // Strict ISO parsing

    if (!date.isValid()) {
        throw new Error(
            `Invalid date: ${dateString}. Expected ISO format YYYY-MM-DD`
        );
    }

    const startOfMonth = date.clone().startOf("month");
    const endOfMonth = date.clone().endOf("month");
    let workingDays = 0;

    let currentDate = startOfMonth.clone();
    while (currentDate.isSameOrBefore(endOfMonth)) {
        const dayOfWeek = currentDate.day();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            workingDays++;
        }
        currentDate.add(1, "day");
    }

    return workingDays;
};

function calculateSalary(baseSalary, workingDays, leaves) {
    const daysWorked = workingDays - leaves;
    return ((baseSalary / workingDays) * daysWorked).toFixed(2);
}

function numberToIndianCurrencyWords(num) {
    // Ensure numeric and positive integer
    if (typeof num === "string") num = num.trim();
    if (num === "" || isNaN(num) || !isFinite(num)) return "Invalid amount";
    num = Math.floor(Number(num));
    if (num < 0) return "Negative amounts not supported";
    if (num === 0) return "Zero Rupees Only.";

    const units = [
        "",
        "One",
        "Two",
        "Three",
        "Four",
        "Five",
        "Six",
        "Seven",
        "Eight",
        "Nine",
        "Ten",
        "Eleven",
        "Twelve",
        "Thirteen",
        "Fourteen",
        "Fifteen",
        "Sixteen",
        "Seventeen",
        "Eighteen",
        "Nineteen",
    ];
    const tens = [
        "",
        "",
        "Twenty",
        "Thirty",
        "Forty",
        "Fifty",
        "Sixty",
        "Seventy",
        "Eighty",
        "Ninety",
    ];

    const numToWords = (n) => {
        if (n === 0) return "";
        if (n < 20) return units[n];
        if (n < 100)
            return tens[Math.floor(n / 10)] + (n % 10 ? " " + units[n % 10] : "");
        return (
            units[Math.floor(n / 100)] +
            " Hundred" +
            (n % 100 ? " And " + numToWords(n % 100) : "")
        );
    };

    const parts = [
        { value: 10000000, name: "Crore" },
        { value: 100000, name: "Lakh" },
        { value: 1000, name: "Thousand" },
        { value: 100, name: "Hundred" },
    ];

    let words = "";
    for (const part of parts) {
        const quotient = Math.floor(num / part.value);
        if (quotient > 0) {
            words += numToWords(quotient) + " " + part.name + " ";
            num %= part.value;
        }
    }

    if (num > 0) {
        words += (words ? "And " : "") + numToWords(num) + " ";
    }

    // Clean up double spaces and format output
    return words.replace(/\s+/g, " ").trim() + " Rupees Only.";
}

const calculateSalaryStats = (employees) => {
    return employees.reduce(
        (acc, emp) => {
            acc.totalSalaries += parseFloat(emp["Net Pay"]) || 0;
            acc.professionalTax += parseFloat(emp["Professional Tax"]) || 0;
            acc.tds += parseFloat(emp["TDS"]) || 0;
            return acc;
        },
        { totalSalaries: 0, professionalTax: 0, tds: 0 }
    );
};

module.exports = {
    calculateWorkingDays,
    calculateSalary,
    numberToIndianCurrencyWords,
    calculateSalaryStats,
};
