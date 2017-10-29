function updateSum() {
    remoteStorage["study-planner"].listCourses().then(objects => {
        var sumPoints = 0;
        var sumMarks = 0;
        var avgMarks;
        var counter = 0;
        for (var path in objects) {
            console.log(path, objects[path]);

            if (parseFloat(objects[path].mark) <= 4) {
                sumPoints += parseInt(objects[path].moduleLp);
                sumMarks += parseFloat(objects[path].mark);
                counter++;
            }
        }
        avgMarks = sumMarks / counter;
        $('#sum').text(sumPoints);
        $('#avg').text(isNaN(avgMarks) ? "" : avgMarks);
    });
}

function showModuleSum() {
    remoteStorage["study-planner"].listCourses().then(objects => {
        var helperDict = {};
        var helperArray = [];
        for (var path in objects) {
            if (helperDict[objects[path].moduleGroup] === undefined) {
                helperDict[objects[path].moduleGroup] = {
                    success: objects[path].mark !== "" && parseFloat(objects[path].mark) <= 4 ? parseInt(objects[path].moduleLp) : 0,
                    planned: objects[path].mark === "" || parseFloat(objects[path].mark) <= 4 ? parseInt(objects[path].moduleLp) : 0
                };
            } else {
                helperDict[objects[path].moduleGroup].success += objects[path].mark !== "" && parseFloat(objects[path].mark) <= 4 ? parseInt(objects[path].moduleLp) : 0;
                helperDict[objects[path].moduleGroup].planned += objects[path].mark === "" || parseFloat(objects[path].mark) <= 4 ? parseInt(objects[path].moduleLp) : 0;
            }
        }

        $('#moduleSumTable').empty();
        var totalSum = 0;
        var totalSumPlanned = 0;

        Object.keys(helperDict).forEach(function (key) {
            totalSum += helperDict[key].success;
            totalSumPlanned += helperDict[key].planned;
            helperArray.push(key);
        });

        helperArray.sort();

        for (var i = 0; i < helperArray.length; i++) {
            var html = `<tr>
                                <td>${helperArray[i]}</td>
                                <td>${helperDict[helperArray[i]].success} <span style="color: grey">(${helperDict[helperArray[i]].planned})</span></td>
                            </tr>`;
            $('#moduleSumTable').append(html);
        }

        $('#sumFoot').html(`${totalSum} <span style="color: grey">(${totalSumPlanned})</span>`);

    });
}

(function () {
    function init() {
        // Enable change events for changes in the same browser window
        RemoteStorage.config.changeEvents.window = true;

        // Claim read/write access for the ["study-planner"] category
        remoteStorage.access.claim('study-planner', 'rw');

        // Display the RS connect widget
        remoteStorage.displayWidget();

        remoteStorage["study-planner"].init();

        remoteStorage["study-planner"].listCourses().then(objects => {
            for (var path in objects) {
                console.log(path, objects[path]);
                displayModule(objects[path]);
            }
        });

        remoteStorage["study-planner"].on('change', function (event) {
            console.log('Change from ' + event.origin + ' (add)', event);
            if (event.newValue && (!event.oldValue)) {
                if (event.origin !== "local") {
                    displayModule(event.newValue);
                }
            }
            else if ((!event.newValue) && event.oldValue) {
                console.log('Change from ' + event.origin + ' (remove)', event);
                hideModule(event.relativePath);
            }
            else if (event.newValue && event.oldValue) {
                console.log('Change from ' + event.origin + ' (change)', event);
                // TODO update module
            }
        });

        transferToRemote();
        $(document).on('click', '.addButton', function (event) {
            addModule();
        });

        $(document).on('click', '.deleteButton', function () {
            var id = $(this).parents('tr').attr('data-id');;
            remoteStorage["study-planner"].removeCourse(id);
        });
    }

    function displayModule(module) {
        var html = '<tr data-id=' + module.moduleId + '><td>' + module.moduleGroup + '</td><td>' + module.moduleName + '</td><td>' + module.moduleLp + '</td><td><div contenteditable class="semester">' + module.semester + '</div></td><td><div contenteditable class="grade">' + module.mark + '</div></td><td><span class="deleteButton glyphicon glyphicon-remove"></span></td></tr>';

        $('#moduleTable').append(html);
        updateSum();
        showModuleSum();
        markModulesGreen();
    }

    function hideModule(id) {
        $(`#moduleTable tr[data-id="${id}"]`).remove();
        updateSum();
        showModuleSum();
    }

    document.addEventListener('DOMContentLoaded', init);

})();