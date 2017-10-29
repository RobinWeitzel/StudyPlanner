RemoteStorage.defineModule('studyPlanner', function (privateClient) {

    privateClient.declareType('course', {
        "type": "object",
        "properties": {
            "moduleId": { type: 'string' },
            "moduleGroup": { type: 'string' },
            "mark": { type: 'string' },
            "moduleLp": { type: 'string' },
            "semester": { type: 'string' },
            "moduleName": { type: 'string' },
        },
        "required": ["moduleId", "moduleGroup", "moduleName", "moduleLp"]
    });

    // Return and export public functions
    return {
        exports: {
            init: function () {
                privateClient.cache('');
            },

            on: privateClient.on,

            addCourse: function (course) {
                return privateClient.storeObject('course', course.moduleId, course);
            },

            getCourse: privateClient.getObject.bind(privateClient),

            removeCourse: privateClient.remove.bind(privateClient),

            listCourses: function () {
                return privateClient.getAll('');
            }
        }
    };
});