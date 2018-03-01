const TITLE_X_POSITION = 56.692;
const TITLE_Y_POSITION = 500;

let modules = new Map();
let chosenModules = new Map();

const remoteStorage = new RemoteStorage({
    modules: [studyPlanner],
    changeEvents: { local: true, window: true, remote: true, conflicts: true },
});

/**
 * Parses a PDF file
 * 
 * @param {Object} file A file object read in by the HTML5 file API
 * @param {Function} callback A callback functino called once all pages have been read in. A page array is passe din as the first argument.
 */
const parsePDF = (file, callback) => {
    const pages = []; // Gathers all parsed pages with a title
    const typedarray = new Uint8Array(file);
    PDFJS.getDocument(typedarray).then(pdf => {
        for (let i = 1; i <= pdf.numPages; i++) {
            pdf.getPage(i).then(page => {
                page.getTextContent().then(textContent => {
                    const pageTitle = textContent.items.filter(line => line.transform[4] === TITLE_X_POSITION && line.transform[5] >= TITLE_Y_POSITION);
                    pages.push({
                        number: i,
                        raw: page,
                        title: pageTitle.length > 0 ? pageTitle[0].str : "",
                        text: textContent.items
                    });
                    if (pages.length === pdf.numPages) { // Check after each page if processing is finished
                        callback(pages);
                    }
                });
            });
        }
    });
}

const parseTableOfContents = pages => {
    // Regular expressions
    const startsWithModuleName = /^[A-Z]+-[0-9]+/;
    const endsWithPageNumber = /.[0-9]+$/;
    const startsChapter = /^([0-9])+\) /;
    const startsSubchapter = /^([a-z])+\) /;
    const endsWithEcts = /ECTS:[^[0-9]+([0-9]+)[^0-9]*([0-9]*)/;
    const inMiddleEcts = /\(([0-9]+)[^]ECTS/;
    const inMiddleOptional = /ECTS\/LP,[^[A-z]*([A-z]+)/;
    const inMiddleName = /^[A-Z]+-[0-9]+: ([^\(]+)/;

    // Makes sure that each line in the table of contents is saved as one item of the lines array (concat multi-line titles)
    const lines = [];
    pages.forEach(page => {
        for (let i = 0; i < page.text.length; i++) {
            let realText = page.text[i].str;
            if (realText.match(startsWithModuleName)) {
                while (!realText.match(endsWithPageNumber) && i + 1 < page.text.length) { // While the end of the lines has not been reached
                    i++;
                    realText += " " + page.text[i].str;
                }
                lines.push(realText); // Adds the next line to the text
            } else if (realText.match(startsChapter) || realText.match(startsSubchapter)) {
                while (i + 1 < page.text.length && page.text[i + 1].height === page.text[i].height) { // Add lines as long as they are the same height and there are still lines to add
                    i++;
                    realText += " " + page.text[i].str;
                }
                lines.push(realText); // Adds the next line to the text
            }
        }
    });

    let currentChapter;
    let currentSubchapter;
    const result = [];

    lines.forEach(line => {
        try {
            let ects;
            if (line.match(startsChapter)) {
                try {
                    let helper = endsWithEcts.exec(line);
                    if (helper.length > 2) {
                        ects = {
                            min: helper[1],
                            max: helper[2]
                        }
                    } else {
                        etcs = {
                            min: helper[1],
                            max: helper[1]
                        }
                    }
                } catch {
                    ects = {
                        min: 0,
                        max: 0
                    };
                }
                currentChapter = {
                    name: line,
                    ects: ects

                };
            } else if (line.match(startsSubchapter)) {
                currentSubchapter = {
                    name: line
                };
            } else {
                const id = startsWithModuleName.exec(line)[0]; // 0 is the whole matched string
                try {
                    ects = parseInt(inMiddleEcts.exec(line)[1], 10); // 1 is the first matched parenthesis
                } catch {
                    ects = 0
                }
                let optional;
                if (line.match(inMiddleOptional)) optional = inMiddleOptional.exec(line)[1];  // 1 is the first matched parenthesis
                else optional = "Pflicht";
                const name = inMiddleName.exec(line)[1].slice(0, -1);  // 1 is the first matched parenthesis
                result.push({
                    id: id,
                    ects: ects,
                    optional: optional,
                    chapter: currentChapter,
                    subChapter: currentSubchapter,
                    name: name
                });
            }
        } catch {
            console.error("Error in line: " + line);
        }
    });
    return result;
}

const fillFooter = () => {
    let counter = 0;
    let counter2 = 0;
    chosenModules.forEach((m, k) => {
        if (m.mark && m.mark !== '' && !isNaN(m.mark) && m.mark <= 4) {
            counter += m.ects;
            counter2 += m.mark * m.ects;
        }
    });

    $('#table-foot').empty();
    $('#table-foot').append(`
        <td></td>
        <td></td>
        <td style="font-weight:bold; text-align: right;">Gesammt</td>
        <td style="font-weight:bold; text-align: center;">${counter > 0 ? counter2 / counter : ''}</td>
        <td style="font-weight:bold; text-align: right;">${counter}</td>
    `);
}

const fillTable = () => {
    let headers = new Map();
    chosenModules.forEach((m, key) => {
        if (!headers.has(m.chapter.name)) headers.set(m.chapter.name, m.chapter);
    });

    headers = new Map([...headers.entries()].sort()); // Sort header by name
    console.log(headers);
    $('#table-body').empty();
    headers.forEach((h, key) => {
        $('#table-body').append(`
            <tr class="header" data-id="${key}">
                <td>
                <i class="fas fa-angle-down fa-lg"></i>
                </td>
                <td colspan="2" style="text-align: left;">
                    ${key.split('ECTS')[0]}
                </td>
                <td class="sum" colspan="2" style="text-align: right;">
                    ${0 + " von " + h.ects.min}
                </td>
            </tr>
        `);
        let counter = 0;
        chosenModules.forEach((m, k) => {
            if (m.chapter.name === key) {
                $('#table-body').append(`
                    <tr class="module" data-id="${k}" data-name="${m.name}" data-chapter="${key}">
                        <td>
                            <i data-id="${k}" data-chapter="${key}" class="far fa-square fa-lg"></i>
                        </td>
                        <td style="text-align: left;">
                            ${m.name}
                        </td>
                        <td style="text-align: center;">
                            <input data-id="${k}" class="semester form-control form-control-sm" type="text" value="${m.semester || ''}">
                        </td>
                        <td style="text-align: center;">
                            <input data-id="${k}" class="mark form-control form-control-sm" type="text" value="${m.mark || ''}">
                        </td>
                        <td style="text-align: right;" class="ects" data-id="${k}">
                            ${m.mark && m.mark !== '' && !isNaN(m.mark) && m.mark <= 4 ? m.ects : 0}
                        </td>
                    </tr>
                `);
                if (m.mark && m.mark !== '' && !isNaN(m.mark) && m.mark <= 4) {
                    counter += m.ects;
                }
            }
        });

        $('.header[data-id="' + key + '"] .sum').html(counter + " von " + h.ects.min);
    });

    fillFooter();
}

$('#file-browser').on('change', event => {
    if (event.target.files.length < 1) return;
    waitingDialog.show('Lese Modulhandbuch...');
    const file = event.target.files[0];
    const fileReader = new FileReader();
    fileReader.onload = event => {
        parsePDF(event.target.result, (pages) => {
            if (pages.length == 0 || !pages.filter(page => page.number === 1)[0].title === "Universität Augsburg") return;

            pages.sort((a, b) => a.number - b.number); // Sort the array in case it is in the wrong order (caused by the async page reading)

            modules = new Map();
            parseTableOfContents(pages.filter(page => page.title === "Inhaltsverzeichnis")).forEach(m => {
                if (!modules.has(m.id)) modules.set(m.id, {
                    id: m.id,
                    ects: m.ects,
                    optional: m.optional,
                    chapter: [m.chapter],
                    subChapter: [m.subChapter],
                    name: m.name
                });
                else {
                    modules.get(m.id).chapter.push(m.chapter);
                    modules.get(m.id).subChapter.push(m.subChapter);
                }
            });

            modules.forEach((m, key) => {
                let term = "";
                const relevantPages = pages.filter(page => page.title === "Modul " + m.id);

                relevantPages.forEach(p => {
                    // Search for term info
                    for (let i = 0; i < p.text.length; i++) {
                        if (p.text[i].str.startsWith("Angebotshäufigkeit")) {
                            i++;
                            while (i < p.text.length && !p.text[i].str.startsWith("Empfohlenes Fachsemester")) {
                                term += p.text[i].str + " ";
                                i++;
                            }
                        }
                    }
                });

                m.term = term.slice(0, -1);
                m.pages = relevantPages;
            });
            console.log(modules);
            fillTable();
            waitingDialog.hide();
        });
    };
    fileReader.readAsArrayBuffer(file);
});

const filter = () => {
    $('.module2').each((index, m) => {
        if (m.dataset.chapterFilter === "true" && m.dataset.termFilter === "true" && m.dataset.searchFilter === "true") $(m).show();
        else $(m).hide();
    });
}

const fillTable2 = () => {
    const headers = new Map();
    modules.forEach((m, k) => {
        if (!chosenModules.has(k)) {
            m.chapter.forEach(c => {
                if (!headers.has(c.name)) headers.set(c.name, c);
            });
        }
    });

    $('#table-body2').empty();
    headers.forEach((header, key) => {
        $('#table-body2').append(`
            <tr class="header2" data-id="${key}">
                <td>
                <i class="fas fa-angle-right fa-lg"></i>
                </td>
                <td style="text-align: left;">
                    ${key.split('ECTS')[0]}
                </td>
                <td style="text-align: right;">
                    ${0 + " von " + header.ects.min}
                </td>
            </tr>
        `);

        modules.forEach((m, k) => {
            if (!chosenModules.has(k) && m.chapter.filter(c => c.name === key).length > 0) {
                $('#table-body2').append(`
                    <tr class="module2" data-id="${k}" data-name="${m.name}" data-chapter="${key}" data-term="${m.term}" data-chapter-filter=${false} data-term-filter=${true} data-search-filter=${true}>
                        <td>
                        <i data-id="${k}" data-chapter="${key}" class="far fa-square fa-lg"></i>
                        </td>
                        <td style="text-align: left;">
                            ${m.name}
                        </td>
                        <td style="text-align: right;">
                            ${m.ects}
                        </td>
                    </tr>
                `);
            }
        });
        filter();
    });
}

$('#add-modules').on('click', () => {
    fillTable2();
    $('#default-view').hide();
    $('#add-view').show();
    renderPDF("preview");
});

$('#add-modules-cancel').on('click', () => {
    fillTable();
    $('#default-view').show();
    $('#add-view').hide();
});

$('#add-modules-confirm').on('click', () => {
    $('.module2 .fa-check-square').each((index, fa) => {
        const m = modules.get(fa.dataset.id);
        chosenModules.set(fa.dataset.id, {
            id: m.id,
            ects: m.ects,
            optional: m.optional,
            chapter: m.chapter.filter(c => c.name === fa.dataset.chapter)[0],
            subChapter: [m.subChapter],
            name: m.name
        });
        remoteStorage.courses.add(chosenModules.get(fa.dataset.id));
    });
    fillTable();
    $('#add-view').hide();
    $('#default-view').show();
});

$(document).on('click', '.filter', (e) => {
    const faIcon = $(e.currentTarget).find('.far');
    if (faIcon.hasClass('fa-square')) {
        faIcon.removeClass('fa-square');
        faIcon.addClass('fa-check-square');

        const summerTerm = (new Date).getMonth() > 2 && (new Date).getMonth() < 9;

        if (summerTerm) {
            $('.module2[data-term="jedes Wintersemester"]').attr('data-term-filter', false);
            $('.module2[data-term="jedes Sommersemester"]').attr('data-term-filter', true);
        } else {
            $('.module2[data-term="jedes Wintersemester"]').attr('data-term-filter', true);
            $('.module2[data-term="jedes Sommersemester"]').attr('data-term-filter', false);
        }

    } else {
        faIcon.removeClass('fa-check-square');
        faIcon.addClass('fa-square');
        $('.module2').attr('data-term-filter', true);
    }
    filter();
});

$(document).on('click', '.header2', (e) => {
    const faIcon = $(e.currentTarget).find('.fas');
    if (faIcon.hasClass('fa-angle-right')) {
        faIcon.removeClass('fa-angle-right');
        faIcon.addClass('fa-angle-down');
        $('.module2[data-chapter="' + e.currentTarget.dataset.id + '"]').attr('data-chapter-filter', true);
    } else {
        faIcon.removeClass('fa-angle-down');
        faIcon.addClass('fa-angle-right');
        $('.module2[data-chapter="' + e.currentTarget.dataset.id + '"]').attr('data-chapter-filter', false);
    }
    filter();
});

$(document).on('click', '.module2 .far', (e) => {
    const faIcon = $(e.currentTarget);
    if (faIcon.hasClass('fa-square')) {
        faIcon.removeClass('fa-square');
        faIcon.addClass('fa-check-square');
    } else {
        faIcon.removeClass('fa-check-square');
        faIcon.addClass('fa-square');
    }
});

$('#search').on('input', e => {
    $('.module2').each((index, m) => {
        if (m.dataset.name.startsWith(e.target.value) || m.dataset.id.startsWith(e.target.value)) m.dataset.searchFilter = true;
        else m.dataset.searchFilter = false;
    });
    filter();
});

let p;

renderPDF = (id) => {
    const canvas = document.getElementById('canvas');
    const context = canvas.getContext('2d');
    const pages = modules.get(id) ? modules.get(id).pages : undefined;
    if (pages !== undefined) {
        if (p < 0) p = 0;
        if (p >= pages.length) p = pages.length - 1;
        const page = pages[p].raw;

        const viewport = page.getViewport($('#canvas-container').width() / page.getViewport(1).width);

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        page.render(renderContext);
    } else {
        context.canvas.width = $('#canvas-container').width();
        context.font = "30px Arial";
        context.fillText("Preview", 10, 50);
        context.font = "20px Arial";
        context.fillText("Auf Module klicken um PDF anzuzeigen.", 10, 100);
    }
}

renderPDFLarge = (id) => {
    const canvas = document.getElementById('canvas2');
    const context = canvas.getContext('2d');
    const pages = modules.get(id) ? modules.get(id).pages : undefined;
    if (pages !== undefined) {
        if (p < 0) p = 0;
        if (p >= pages.length) p = pages.length - 1;
        const page = pages[p].raw;

        const viewport = page.getViewport($('#canvas-container2').width() / page.getViewport(1).width);

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        page.render(renderContext);
    } else {
        context.canvas.width = $('#canvas-container2').width();
        context.font = "30px Arial";
        context.fillText("Preview", 10, 50);
        context.font = "20px Arial";
        context.fillText("Auf Module klicken um PDF anzuzeigen.", 10, 100);
    }
}

$(document).on('click', '.module2', (e) => {
    $('#table-body2').find('.table-info').removeClass('table-info');
    $(e.currentTarget).addClass('table-info');
    p = 0;
    renderPDF(e.currentTarget.dataset.id);
});


$(document).on('click', '.canvas-backward', (e) => {
    p--;
    renderPDF($('.module2.table-info').length > 0 ? $('.module2.table-info').attr('data-id') : 'Preview');
    renderPDFLarge($('.module2.table-info').length > 0 ? $('.module2.table-info').attr('data-id') : 'Preview');
});

$(document).on('click', '.canvas-forward', (e) => {
    p++;
    renderPDF($('.module2.table-info').length > 0 ? $('.module2.table-info').attr('data-id') : 'Preview');
    renderPDFLarge($('.module2.table-info').length > 0 ? $('.module2.table-info').attr('data-id') : 'Preview');
});

$('#canvas').on('click', (e) => {
    $('#exampleModalLong').modal();
})

$('#exampleModalLong').on('shown.bs.modal', () => {
    renderPDFLarge($('.module2.table-info').length > 0 ? $('.module2.table-info').attr('data-id') : 'Preview');
});

$(document).on('input', '.mark', e => {
    const value = e.currentTarget.value.replace(',', '.');
    const mark = value !== '' && !isNaN(value) ? parseFloat(value, 10) : '';
    const oldMark = chosenModules.get(e.currentTarget.dataset.id).mark;
    const chapter = chosenModules.get(e.currentTarget.dataset.id).chapter;
    chosenModules.get(e.currentTarget.dataset.id).mark = mark;
    remoteStorage.courses.add(chosenModules.get(e.currentTarget.dataset.id));
    console.log(chosenModules.get(e.currentTarget.dataset.id));
    $('.ects[data-id="' + e.currentTarget.dataset.id + '"]').html(mark !== '' && !isNaN(mark) && mark <= 4 ? chosenModules.get(e.currentTarget.dataset.id).ects : 0);

    let counter = 0;
    chosenModules.forEach((m, key) => {
        if (m.chapter.name === chapter.name) {
            if (m.mark && m.mark !== '' && !isNaN(m.mark) && m.mark <= 4) {
                counter += m.ects;
            }
        }
    });

    $('.header[data-id="' + chapter.name + '"] .sum').html(counter + " von " + chapter.ects.min);
    fillFooter();
});

$(document).on('input', '.semester', e => {
    chosenModules.get(e.currentTarget.dataset.id).semester = e.currentTarget.value;
    remoteStorage.courses.add(chosenModules.get(e.currentTarget.dataset.id));
});

$(document).on('click', '.header', (e) => {
    const faIcon = $(e.currentTarget).find('.fas');
    if (faIcon.hasClass('fa-angle-right')) {
        faIcon.removeClass('fa-angle-right');
        faIcon.addClass('fa-angle-down');
        $('.module[data-chapter="' + e.currentTarget.dataset.id + '"]').show();
    } else {
        faIcon.removeClass('fa-angle-down');
        faIcon.addClass('fa-angle-right');
        $('.module[data-chapter="' + e.currentTarget.dataset.id + '"]').hide();
    }
});

$(document).on('click', '.module .far', e => {
    const faIcon = $(e.currentTarget);
    if (faIcon.hasClass('fa-square')) {
        faIcon.removeClass('fa-square');
        faIcon.addClass('fa-check-square');
    } else {
        faIcon.removeClass('fa-check-square');
        faIcon.addClass('fa-square');
    }
});

$('#remove-modules').on('click', e => {
    $('.module .fa-check-square').each((index, fa) => {
        const chapter = chosenModules.get(fa.dataset.id).chapter;
        chosenModules.delete(fa.dataset.id);
        remoteStorage.courses.remove(fa.dataset.id);
        $('.module[data-id="' + fa.dataset.id + '"]').remove();

        let counter = 0;
        let counter2 = 0;
        chosenModules.forEach((m, key) => {
            if (m.chapter.name === chapter.name) {
                if (m.mark && m.mark !== '' && !isNaN(m.mark) && m.mark <= 4) {
                    counter += m.ects;
                }
                counter2++;
            }
        });
        if (counter2 > 0) $('.header[data-id="' + chapter.name + '"] .sum').html(counter + " von " + chapter.ects.min);
        else $('.header[data-id="' + chapter.name + '"]').remove();
    });
    fillFooter();
});

init = () => {
    remoteStorage.access.claim('courses', 'rw');
    remoteStorage.caching.enable('/courses/');
    remoteStorage.setApiKeys({
        dropbox: '16leb3r5xqor7yn',
        googledrive: '1037413949891-ji43hqqjaqrtq382m20k1p1h2k7aabnt.apps.googleusercontent.com'
    });

    const widget = new Widget(remoteStorage);
    widget.attach('widget-container');

    remoteStorage.courses.init();

    remoteStorage.courses.on('change', event => {
        if (event.newValue && (!event.oldValue)) {
            console.log('Change from ' + event.origin + ' (add)', event);
        }
        else if ((!event.newValue) && event.oldValue) {
            console.log('Change from ' + event.origin + ' (remove)', event);
        }
        else if (event.newValue && event.oldValue) {
            console.log('Change from ' + event.origin + ' (change)', event);
            // TODO update drink
        }
    });

    remoteStorage.on('ready', () => {
        remoteStorage.courses.listCourses().then(objects => {
            for (var path in objects) {
                if(objects[path].id) {
                    chosenModules.set(objects[path].id, objects[path]);
                }
            }
            fillTable();
        });

    });
}

document.addEventListener('DOMContentLoaded', init);

var waitingDialog = waitingDialog || (function ($) {
    'use strict';

    // Creating modal dialog's DOM
    var $dialog = $(
        '<div class="modal fade" data-backdrop="static" data-keyboard="false" tabindex="-1" role="dialog" aria-hidden="true" style="padding-top:15%; overflow-y:visible;">' +
        '<div class="modal-dialog modal-m">' +
        '<div class="modal-content">' +
        '<div class="modal-header"><h3 style="margin:0;"></h3></div>' +
        '<div class="modal-body">' +
        '<div class="progress progress-striped active" style="margin-bottom:0;"><div class="progress-bar" style="width: 100%"></div></div>' +
        '</div>' +
        '</div></div></div>');

    return {
        /**
         * Opens our dialog
         * @param message Custom message
         * @param options Custom options:
         * 				  options.dialogSize - bootstrap postfix for dialog size, e.g. "sm", "m";
         * 				  options.progressType - bootstrap postfix for progress bar type, e.g. "success", "warning".
         */
        show: function (message, options) {
            // Assigning defaults
            if (typeof options === 'undefined') {
                options = {};
            }
            if (typeof message === 'undefined') {
                message = 'Loading';
            }
            var settings = $.extend({
                dialogSize: 'm',
                progressType: '',
                onHide: null // This callback runs after the dialog was hidden
            }, options);

            // Configuring dialog
            $dialog.find('.modal-dialog').attr('class', 'modal-dialog').addClass('modal-' + settings.dialogSize);
            $dialog.find('.progress-bar').attr('class', 'progress-bar');
            if (settings.progressType) {
                $dialog.find('.progress-bar').addClass('progress-bar-' + settings.progressType);
            }
            $dialog.find('h3').text(message);
            // Adding callbacks
            if (typeof settings.onHide === 'function') {
                $dialog.off('hidden.bs.modal').on('hidden.bs.modal', function (e) {
                    settings.onHide.call($dialog);
                });
            }
            // Opening dialog
            $dialog.modal();
        },
        /**
         * Closes dialog
         */
        hide: function () {
            $dialog.modal('hide');
        }
    };

})(jQuery);

