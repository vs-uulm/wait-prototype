library(tidyverse)
library(scales)

files = c("times-baseline.csv", "times-extension.csv")
labels = c("Baseline", "WAIT")

data <- files %>%
    map_df(function(x) read_csv(x, col_names = TRUE)
          %>% mutate(type = labels[match(x, files)])
          %>% mutate(time = domComplete - requestStart)
    )

results <- data %>% group_by(type) %>% summarize(
        t.min = min(time),
        t.max = max(time),
        t.mean = mean(time),
        t.median = median(time),
        t.sd = sd(time),
        t.q99 = quantile(time, .99),
        t.num = n()
    )

data %>% ggplot(aes(x=type, y=time)) +
         geom_boxplot(aes(color=type), size=.2, position=position_dodge(0.95)) +
         scale_color_manual(values=c("#a32638", "#26547c"), name="Type", guide = guide_legend(reverse=F)) +
         xlab("Type") +
         ylab("Time [ms]") +
         theme(legend.position = "none") +
         scale_y_continuous(label=comma, limits=c(0, 2000))

write_csv(results, "statistics.csv")
ggsave("plot.pdf", plot = last_plot(), scale = 1, width = 84.75, height = 60, units = "mm", dpi = 300)
results

