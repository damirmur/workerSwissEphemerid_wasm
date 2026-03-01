import { Piscina } from 'piscina';
import pino from 'pino';
import path from 'path';
import { dailyPlanetsTask } from './worker.js';

const piscina = new Piscina({
    filename: path.resolve('./worker.js'),
    maxThreads: 2, // Укажите количество ядер вашего CPU
    maxTasksPerWorker: 500
});
const logger = pino({
    level: 'info', // Убедитесь, что уровень info, а не error
    transport: { target: 'pino-pretty' }
});
async function runTasks() {
    try {
        const resDaily = await piscina.run();
        logger.info({ resDaily }, 'Результат ежедневной задачи');

    } catch (err) {
        logger.error({ err: err.message }, 'Ошибка выполнения задач');
    }
}


runTasks();
process.on('SIGINT', async () => { await piscina.destroy(); process.exit(0); });
