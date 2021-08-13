import { test } from "./perf_tests.js"
import { performance } from 'perf_hooks'

let i = 0
const run = () => {
    setImmediate(() => {
        test(performance)
        // if( i++ < 20 ) run()
    })
}
run()