# StudyPlanner
Via this site, students from the University can plan their semesters by uploading their ["Modulhanbuch"](https://www.uni-augsburg.de/mhb/).
This site is not affiliated with the University of Augsburg.

This is an exmaple of reading, processing and displaying files uploaded via html-input in memory.
No server-side code required.

The uploaded text is stored in the localStorage as well as the selected modules.
Unfortuantely, the pdf can not be stored due to circular structures (meaning the pdf cant be converted to JSON ;).

This site uses [PDF.js](https://mozilla.github.io/pdf.js/) to parse and display the pdf-files.
It also uses ehpc's [waiting-dialog](https://bootsnipp.com/snippets/featured/quotwaiting-forquot-modal-dialog).