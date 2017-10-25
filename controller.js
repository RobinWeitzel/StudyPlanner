const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');

/**
 * Loads the save on document ready
 */
$(document).ready(function () {
    loadSave();
});

/**
 * Adds a click listener to the #openModuleDialog button
 */
$('#openModuleDialog').on('click', function () {

    // Clear the canvas
    context.clearRect(0, 0, canvas.width, canvas.height);

    $('#moduleGroup').empty();
    $('#moduleGroup').append('<option disabled selected>Modulgruppe wählen</option>')
    for (let i = 0; i < moduleGroups.length; i++) {
        $('#moduleGroup').append("<option value='" + moduleGroups[i] + "'>" + moduleGroups[i] + "</option>");
    }

    $('#module').empty();
    $('#semester').val("");
    $('#mark').val("");

    $('#myModal').modal('show');
});

$(document).on('click', '#addModule', function() {
    const module = {
        id: $('#module').val(),
        group: $('#moduleGroup').val(),
        semester: $('#semester').val(),
        mark: $('#mark').val()
    }

    addModule(module);
    displayModule(module);
    updateSum();
    markModulesGreen();
    $('#myModal').modal('hide');
});

$(document).on('change', '#moduleGroup', function () {
    $('#module').empty();
    $('#module').append('<option value="" disabled selected>Modul wählen</option>')
    Object.keys(moduleDict).forEach(function (currentKey) {
        const mg = moduleDict[currentKey].moduleGroup;

        if (mg.indexOf($('#moduleGroup').val()) >= 0 && getIds(modulesSelected).indexOf(currentKey) < 0) {
            $('#module').append("<option value='" + currentKey + "'>" + moduleDict[currentKey].moduleName + "</option>");
        }
    });
});

$(document).on('click', '#back', function () {
    p--;
    const id = $('#module').val();
    renderPDF(id, canvas, context);
});

$(document).on('click', '#forward', function () {
    p++;
    const id = $('#module').val();
    renderPDF(id, canvas, context);
});

$(document).on('change', '#module', function () {
    const id = $('#module').val();
    renderPDF(id, canvas, context);
});

$(document).on('click', '.deleteButton', function () {
    const id = $(this).parents('tr').attr('data-id');

    for (let i = 0; i < modulesSelected.length; i++) {
        if (modulesSelected[i].moduleId === id) {
            break;
        }
    }
    modulesSelected.splice(i, 1);
    localStorage.setItem("modulesSelected", JSON.stringify(modulesSelected));
    $(this).parents('tr').remove();
    let result = updateSum();

    $('#moduleSumTable').empty();
    $('#sum').text(result.successSum);
    $('#avg').text(result.successAvg);

    let html;
    
    for (let key of result.successMap) {
        html = `<tr>
                    <td>${key}</td>
                    <td>${result.successMap.get(key)} <span style="color: grey">(${result.plannedMap.get(key)})</span></td>
                </tr>`;
        $('#moduleSumTable').append(html);
    }

    $('#sumFoot').html(`${result.successSum} <span style="color: grey">(${result.plannedSum})</span>`);
});

function markModulesGreen() {
    $('#moduleTable tr').each(function () {
        if ($(this).find('.grade').text() !== "" && !isNaN($(this).find('.grade').text()) && parseFloat($(this).find('.grade').text()) <= 4.0) {
            $(this).addClass('success');
            $(this).removeClass('danger');
        } else if ($(this).find('.grade').text() !== "" && !isNaN($(this).find('.grade').text()) && parseFloat($(this).find('.grade').text()) > 4.0) {
            $(this).removeClass('success');
            $(this).addClass('danger');
        } else {
            $(this).removeClass('success');
            $(this).removeClass('danger');
        }
    });
}

function displayModule(module) {
    let html = '<tr data-id=' + module.moduleId + '><td>' + module.moduleGroup + '</td><td>' + module.moduleName + '</td><td>' + module.moduleLp + '</td><td><div contenteditable class="semester">' + module.semester + '</div></td><td><div contenteditable class="grade">' + module.mark + '</div></td><td><span class="deleteButton glyphicon glyphicon-remove"></span></td></tr>';

    $('#moduleTable').append(html);
}

$(document).on('input', 'td > div', function () {
    let id = $(this).parents('tr').attr('data-id');

    for (let i = 0; i < modulesSelected.length; i++) {
        if (modulesSelected[i].moduleId === id) {
            break;
        }
    }

    if ($(this).hasClass('semester')) {
        modulesSelected[i].semester = $(this).text();
    } else {
        modulesSelected[i].mark = $(this).text();
    }
    localStorage.setItem("modulesSelected", JSON.stringify(modulesSelected));
    updateSum();
    markModulesGreen();
});

$('#FileUpload').on('change', function () {
    waitingDialog.show('Lese Modulhandbuch...');
    moduleDict = {};
    moduleGroups = [];
    let file = event.target.files[0];
    if (file) {
        let fileReader = new FileReader();
        fileReader.onload = function (event) {
            let typedarray = new Uint8Array(this.result);
            PDFJS.getDocument(typedarray).then(function (pdf) {
                let pageDict = {};
                let truePages = {};
                for (let i = 1; i <= pdf.numPages; i++) {
                    pdf.getPage(i).then(function (page) {
                        page.getTextContent().then(function (textContent) {
                            truePages[page.pageIndex] = page;
                            pageDict[page.pageIndex] = textContent;
                            if (Object.keys(pageDict).length === pdf.numPages) {
                                parsePdf(pageDict);
                                loadPages(pageDict, truePages);
                            }
                        });
                    });
                }
            });
        };
        fileReader.readAsArrayBuffer(file);
    }
});

