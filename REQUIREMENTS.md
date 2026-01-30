# Multiple targets refactoring

I want to modify the current frontend implementation in a way that is possible to select multiple targets. 
This will affect mainly /targets/run where the UUID will become an array instead of a single target.
- The landing page must be a list of currently running jobs (reporting all the info and the status icon per each row)
- - each row must be an accordion row , on click must be expanded and must show the live logs of the job and a cancel button that must interrupt the job
- in the landing page there must be a Create button that starts the job creation workflow as it is now.
- - Current cluster selection must become a check box instead of a radio button
- Node query on the target can be remove (was only there for demo purposes)