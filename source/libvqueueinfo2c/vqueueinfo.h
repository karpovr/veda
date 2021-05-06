#include <stdint.h>
#include <stdlib.h>
#include <stdbool.h>

typedef struct {
  uint32_t current_count;
  uint32_t total_count;
  const char *err;
} CConsumerInfo;

CConsumerInfo get_info_of_consumer(const char *_base_path,
                                   const char *_consumer_name,
                                   const char *_queue_name);
